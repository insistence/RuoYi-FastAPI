import re
from pathlib import Path
from typing import NotRequired, TypedDict

from config.env import I18nConfig


class _LocaleDefinition(TypedDict):
    """
    单个语言标签的启用状态、别名和回退顺序。

    :ivar enabled: 当前语言是否启用
    :ivar aliases: 可匹配此语言的其他标签
    :ivar fallback: 译文缺失时依次尝试的语言标签
    """

    enabled: NotRequired[bool]
    aliases: tuple[str, ...]
    fallback: tuple[str, ...]


MAX_LOCALE_LENGTH = 63
_SCRIPT_SUBTAG_LENGTH = 4
_REGION_SUBTAG_LENGTH = 2
CATALOG_ROOT = Path(__file__).parent / 'catalogs'
LOCALES: dict[str, _LocaleDefinition] = {
    'zh-CN': {'enabled': True, 'aliases': ('zh', 'zh-Hans'), 'fallback': ()},
    'en-US': {'enabled': True, 'aliases': ('en',), 'fallback': ('zh-CN',)},
}
# 仅为明确允许共享译文的语言族配置回退；不把不同中文文字变体无条件归并。
LANGUAGE_FALLBACKS = {'en': 'en-US'}

# 匹配包含文字、地区、变体、扩展及私有用途子标签的 BCP 47 语言标识。
_TAG = re.compile(
    r'^(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4}|[a-z]{5,8})'
    r'(?:-[a-z]{4})?(?:-[a-z]{2}|-\d{3})?'
    r'(?:-[a-z\d]{5,8}|-\d[a-z\d]{3})*'
    r'(?:-[0-9a-wy-z](?:-[a-z\d]{2,8})+)*(?:-x(?:-[a-z\d]{1,8})+)?$',
    re.I,
)


class LocaleRegistry:
    """语言注册与规范化工具类。"""

    @staticmethod
    def enabled_locales() -> tuple[str, ...]:
        """
        获取协商和编译时使用的已启用语言。

        :return: 按注册顺序排列的语言标签
        :raises ValueError: 默认语言或基准语言未注册或已停用
        """
        enabled = tuple(code for code, entry in LOCALES.items() if entry.get('enabled', True))
        if I18nConfig.i18n_default_locale not in enabled:
            raise ValueError('I18N_DEFAULT_LOCALE must be registered and enabled')
        if I18nConfig.SOURCE_LOCALE not in enabled:
            raise ValueError('SOURCE_LOCALE must be registered and enabled')
        return enabled

    @staticmethod
    def normalize_locale(value: str, *, preference: bool = False) -> str:
        """
        校验并规范化语言标识。

        :param value: 原始语言标识，兼容下划线分隔形式
        :param preference: 是否允许表示跟随设备的 auto 偏好
        :return: 规范化后的语言标识或 auto
        :raises ValueError: 语言标记无效或包含重复扩展
        """
        if not isinstance(value, str) or not value or len(value) > MAX_LOCALE_LENGTH:
            raise ValueError('Invalid locale')
        value = value.strip().replace('_', '-')
        if preference and value == 'auto':
            return value
        if re.fullmatch(r'x(?:-[a-z0-9]{1,8})+', value, re.I):
            return value.lower()
        if not _TAG.fullmatch(value):
            raise ValueError('Invalid locale')
        parts = value.lower().split('-')
        extensions = set()
        in_extension = False
        for index in range(1, len(parts)):
            part = parts[index]
            if part == 'x':
                break
            if len(part) == 1:
                if part in extensions:
                    raise ValueError('Duplicate locale extension')
                extensions.add(part)
                in_extension = True
            if not in_extension:
                if len(part) == _SCRIPT_SUBTAG_LENGTH and part.isalpha():
                    parts[index] = part.title()
                elif len(part) == _REGION_SUBTAG_LENGTH and part.isalpha():
                    parts[index] = part.upper()
        return '-'.join(parts)

    @classmethod
    def match_locale(cls, value: str) -> str | None:
        """
        按语言标识或显式别名匹配已注册语言。

        :param value: 待匹配的语言标识
        :return: 已注册的语言标识，无法匹配时返回 None
        """
        try:
            code = cls.normalize_locale(value)
        except ValueError:
            return None
        enabled = cls.enabled_locales()
        if code in enabled:
            return code
        alias = next((key for key in enabled if code in LOCALES[key]['aliases']), None)
        if alias is not None:
            return alias
        target = LANGUAGE_FALLBACKS.get(code.split('-', 1)[0])
        return target if target in enabled else None

    @staticmethod
    def fallback_chain(code: str) -> tuple[str, ...]:
        """
        生成去重后的语言回退链并校验循环配置。

        :param code: 已注册的语言标识
        :return: 包含基准语言的回退链
        """
        result: list[str] = []

        def visit(item: str, stack: tuple[str, ...] = ()) -> None:
            """
            遍历已启用语言的回退配置并去重。

            :param item: 当前要处理的条目
            :param stack: 当前递归路径上已访问的节点
            :raises ValueError: 语言回退链含有未知语言或循环
            """
            if item in stack or item not in LOCALES:
                raise ValueError('Invalid locale fallback configuration')
            if item not in result and LOCALES[item].get('enabled', True):
                result.append(item)
                for fallback in LOCALES[item]['fallback']:
                    visit(fallback, (*stack, item))

        visit(code)
        visit(I18nConfig.SOURCE_LOCALE)
        return tuple(result)


for _code in LocaleRegistry.enabled_locales():
    LocaleRegistry.fallback_chain(_code)
for _language, _target in LANGUAGE_FALLBACKS.items():
    if LocaleRegistry.normalize_locale(_language) != _language or '-' in _language or _target not in LOCALES:
        raise ValueError('Invalid locale language fallback configuration')
