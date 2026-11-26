import gettext
import logging

from common.context import LocaleContext, RequestContext
from config.env import AppConfig, I18nConfig
from i18n.catalogs import CatalogRegistry
from i18n.message import I18nMessage, validate_plural
from i18n.registry import LocaleRegistry

logger = logging.getLogger(__name__)
SAFE_MESSAGE = '服务暂时不可用，请稍后重试'


class I18nUtil:
    """词库加载、消息翻译与响应字段工具类。"""

    @staticmethod
    def _load_catalog(code: str, domain: str = 'core') -> gettext.GNUTranslations:
        """
        加载并缓存编译后的语言资源。

        :param code: 已注册的语言标识，不接受请求路径
        :param domain: 由调用方指定的可信 gettext 域名
        :return: 编译后的 gettext 翻译对象
        """
        return CatalogRegistry.snapshot(domain).translations[code]

    @classmethod
    def validate_catalogs(cls) -> None:
        """校验全部已注册语言的编译产物是否可加载。"""
        CatalogRegistry.refresh()

    @staticmethod
    def refresh_catalogs(domain: str | None = None) -> None:
        """
        在受信发布操作后刷新词库对象和响应缓存指纹。

        :param domain: 需要刷新的词库域，未指定时刷新全部已注册域
        """
        CatalogRegistry.refresh(domain)

    @classmethod
    def _translate_catalog_message(
        cls,
        code: str,
        msg_key: str,
        params: dict[str, object] | None,
        *,
        domain: str = 'core',
        count: int | None = None,
        plural_key: str | None = None,
    ) -> str | None:
        """
        尝试从单个语言资源中取词并插值。

        :param code: 已注册的语言标识
        :param msg_key: 语义消息标识
        :param params: 消息插值参数
        :param domain: 已注册的词库域
        :param count: 与 plural_key 成对提供的非负整数
        :param plural_key: 复数消息标识
        :return: 翻译后的消息，不可用时返回 None 以继续回退
        """
        try:
            catalog = cls._load_catalog(code, domain)
            value = (
                catalog.ngettext(msg_key, plural_key, count)
                if count is not None and plural_key is not None
                else catalog.gettext(msg_key)
            )
            if value not in (msg_key, plural_key):
                return value % ({**(params or {}), 'count': count} if count is not None else params or {})
            logger.warning(
                'i18n missing translation: domain=%s locale=%s key=%s version=%s',
                domain,
                code,
                msg_key,
                AppConfig.app_version,
            )
        except (OSError, KeyError, ValueError, TypeError, ArithmeticError):
            logger.warning('i18n lookup failed: domain=%s locale=%s key=%s', domain, code, msg_key)
        return None

    @classmethod
    def translate(
        cls,
        msg_key: str,
        params: dict[str, object] | None = None,
        *,
        locale: str | None = None,
        domain: str = 'core',
        count: int | None = None,
        plural_key: str | None = None,
    ) -> str:
        """
        按指定语言及回退链翻译消息。

        :param msg_key: 语义消息标识
        :param params: 消息插值参数
        :param locale: 显式语言快照，未提供时使用当前请求语言
        :param domain: 可信注册表中的词库域，默认 core
        :param count: 与 plural_key 成对传入的非负整数，同时作为 count 插值参数
        :param plural_key: PO 中对应 msgid_plural 的稳定语义标识
        :return: 翻译后的消息，缺译或插值失败时返回安全通用提示
        """
        validate_plural(count, plural_key)
        code = locale or RequestContext.get_current_locale().locale
        try:
            candidates = CatalogRegistry.snapshot(domain).spec.chain(code)
        except (OSError, KeyError, ValueError):
            candidates = ()
        for candidate in candidates:
            value = cls._translate_catalog_message(
                candidate, msg_key, params, domain=domain, count=count, plural_key=plural_key
            )
            if value is not None:
                return value
        # 异常处理中的缺译或插值失败不得再次抛出异常，也不向用户显示内部消息标识。
        # 仅向核心域请求其固定的安全提示，插件业务消息始终在自己的域中查找。
        core_locale = LocaleRegistry.match_locale(code) or I18nConfig.i18n_default_locale
        for candidate in LocaleRegistry.fallback_chain(core_locale):
            safe = cls._translate_catalog_message(candidate, 'common.unavailable', None)
            if safe is not None:
                return safe
        return SAFE_MESSAGE

    @classmethod
    def message_fields(
        cls,
        msg: str | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict[str, object] | None = None,
        default_key: str = 'common.error',
        context: LocaleContext | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> dict[str, object]:
        """
        根据请求语言和消息标识生成响应消息字段。

        :param msg: 调用方指定的消息，可携带翻译元数据
        :param msg_key: 显式语义消息标识，优先于消息自带的标识
        :param msg_params: 可公开的基础类型插值参数
        :param default_key: 未提供消息时使用的默认语义标识
        :param context: 导出或流式响应捕获的语言快照
        :param domain: 已注册的词库域，未指定时使用消息元数据或核心域
        :param count: 与 plural_key 成对提供的非负整数
        :param plural_key: 复数消息标识
        :return: 消息文本及其语义标识和公开参数
        """
        if isinstance(msg, I18nMessage) and msg_key in (None, msg.msg_key):
            msg_key = msg.msg_key
            msg_params = msg.msg_params if msg_params is None else msg_params
            domain = msg.domain if domain is None else domain
            if count is None and plural_key is None:
                count, plural_key = msg.plural_count, msg.plural_key
        domain = domain or 'core'
        validate_plural(count, plural_key)
        context = context or RequestContext.get_current_locale()
        key = msg_key or (default_key if msg is None else None)
        if key is None:
            return {'msg': msg}
        params = msg_params or {}
        # 参数由调用方显式指定，仅保留可公开的基础类型，不直接序列化异常对象。
        safe = {
            name: cls.message_fields(value, context=context)['msg'] if isinstance(value, I18nMessage) else value
            for name, value in params.items()
            if isinstance(value, (str, int, float, bool)) or value is None
        }
        if count is not None:
            safe['count'] = count
        fields = {
            'msg': cls.translate(key, safe, locale=context.locale, domain=domain, count=count, plural_key=plural_key),
            'msgKey': key,
            'msgParams': safe,
        }
        if domain != 'core':
            fields['msgDomain'] = domain
        if count is not None:
            fields.update(msgCount=count, msgPluralKey=plural_key)
        return fields


def t(
    msg_key: str,
    params: dict[str, object] | None = None,
    *,
    locale: str | None = None,
    domain: str = 'core',
    count: int | None = None,
    plural_key: str | None = None,
) -> str:
    """
    即时翻译文本，默认读取调用时的请求语言。

    接口响应应传递 msg_key 和 msg_params，由响应工具保留消息标识和插值参数。
    后台任务等脱离请求的场景应显式传入语言快照。

    :param msg_key: 完整的语义消息标识
    :param params: 消息插值参数
    :param locale: 显式语言快照，未提供时使用当前请求语言
    :param domain: 可信注册表中的词库域，默认 core
    :param count: 与 plural_key 成对传入的非负整数
    :param plural_key: PO 中对应 msgid_plural 的稳定语义标识
    :return: 翻译后的文本
    """
    return I18nUtil.translate(msg_key, params, locale=locale, domain=domain, count=count, plural_key=plural_key)
