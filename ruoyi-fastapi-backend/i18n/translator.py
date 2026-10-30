import gettext
import logging
from functools import lru_cache

from common.context import LocaleContext, RequestContext
from config.env import I18nConfig
from i18n.message import I18nMessage
from i18n.registry import CATALOG_ROOT, LOCALES, LocaleRegistry

logger = logging.getLogger(__name__)
SAFE_MESSAGE = '服务暂时不可用，请稍后重试'


class I18nUtil:
    """
    词库加载、消息翻译与兼容响应工具类
    """

    @staticmethod
    @lru_cache(maxsize=64)
    def _load_catalog(code: str, domain: str = 'core') -> gettext.GNUTranslations:
        """
        加载并缓存编译后的语言资源

        :param code: 已注册的语言标识，不接受请求路径
        :param domain: 由调用方指定的可信 gettext 域名
        :return: 编译后的 gettext 翻译对象
        """
        return gettext.translation(domain, localedir=CATALOG_ROOT, languages=[code])

    @classmethod
    def validate_catalogs(cls) -> None:
        """
        校验全部已注册语言的编译产物是否可加载
        """
        for code in LOCALES:
            cls._load_catalog(code)

    @classmethod
    def _translate_catalog_message(cls, code: str, msg_key: str, params: dict | None) -> str | None:
        """
        尝试从单个语言资源中取词并插值

        :param code: 已注册的语言标识
        :param msg_key: 语义消息标识
        :param params: 消息插值参数
        :return: 翻译后的消息，不可用时返回 None 以继续回退
        """
        try:
            value = cls._load_catalog(code).gettext(msg_key)
            if value != msg_key:
                return value % (params or {})
        except (OSError, KeyError, ValueError, TypeError):
            logger.warning('i18n lookup failed: locale=%s key=%s', code, msg_key)
        return None

    @classmethod
    def translate(cls, msg_key: str, params: dict | None = None, *, locale: str | None = None) -> str:
        """
        按指定语言及回退链翻译消息

        :param msg_key: 语义消息标识
        :param params: 消息插值参数
        :param locale: 显式语言快照，未提供时使用当前请求语言
        :return: 翻译后的消息，缺译或插值失败时返回安全通用提示
        """
        code = locale or RequestContext.get_current_locale().locale
        if code not in LOCALES:
            code = I18nConfig.i18n_default_locale
        for candidate in LocaleRegistry.fallback_chain(code):
            value = cls._translate_catalog_message(candidate, msg_key, params)
            if value is not None:
                return value
        # 异常处理中的缺译或插值失败不得再次抛出异常，也不向用户显示内部消息标识。
        return SAFE_MESSAGE

    @classmethod
    def message_fields(
        cls,
        msg: str | None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        default_key: str = 'common.error',
        legacy_default: str = SAFE_MESSAGE,
        context: LocaleContext | None = None,
    ) -> dict:
        """
        按客户端能力生成兼容的响应消息字段

        :param msg: 调用方显式指定的旧消息原文
        :param msg_key: 显式语义消息标识，优先于旧消息原文
        :param msg_params: 可公开的基础类型插值参数
        :param default_key: 未提供消息时使用的默认语义标识
        :param legacy_default: 旧客户端使用的默认消息原文
        :param context: 导出或流式响应捕获的语言快照
        :return: 消息原文及新客户端支持的语义标识和参数
        """
        if isinstance(msg, I18nMessage) and msg_key is None:
            msg_key = msg.msg_key
            msg_params = msg.msg_params if msg_params is None else msg_params
        context = context or RequestContext.get_current_locale()
        key = msg_key or (default_key if msg is None else None)
        if context.version != 'v1':
            return {'msg': msg if msg is not None else legacy_default}
        if key is None:
            return {'msg': msg}
        params = msg_params or {}
        # 参数由调用方显式指定，仅保留可公开的基础类型，不直接序列化异常对象。
        safe = {
            name: cls.message_fields(value, context=context)['msg'] if isinstance(value, I18nMessage) else value
            for name, value in params.items()
            if isinstance(value, (str, int, float, bool)) or value is None
        }
        return {'msg': cls.translate(key, safe, locale=context.locale), 'msgKey': key, 'msgParams': safe}


def t(msg_key: str, params: dict | None = None, *, locale: str | None = None) -> str:
    """
    即时翻译文本，默认读取调用时的请求语言

    接口响应应传递msg_key和msg_params，由响应工具保留语义信息。
    后台任务等脱离请求的场景应显式传入语言快照。

    :param msg_key: 完整的语义消息标识
    :param params: 消息插值参数
    :param locale: 显式语言快照，未提供时使用当前请求语言
    :return: 翻译后的文本
    """
    return I18nUtil.translate(msg_key, params, locale=locale)
