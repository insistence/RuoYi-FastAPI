import re
from pathlib import Path

from config.env import I18nConfig

MAX_LOCALE_LENGTH = 63
_SCRIPT_SUBTAG_LENGTH = 4
_REGION_SUBTAG_LENGTH = 2
CATALOG_ROOT = Path(__file__).parent / 'catalogs'
LOCALES = {
    'zh-CN': {'aliases': ('zh', 'zh-Hans'), 'fallback': ()},
    'en-US': {'aliases': ('en',), 'fallback': ('zh-CN',)},
}
if I18nConfig.i18n_default_locale not in LOCALES:
    raise ValueError('I18N_DEFAULT_LOCALE must be registered')

# 匹配包含文字、地区、变体、扩展及私有用途子标签的 BCP 47 语言标识。
_TAG = re.compile(
    r'^(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4}|[a-z]{5,8})'
    r'(?:-[a-z]{4})?(?:-[a-z]{2}|-\d{3})?'
    r'(?:-[a-z\d]{5,8}|-\d[a-z\d]{3})*'
    r'(?:-[0-9a-wy-z](?:-[a-z\d]{2,8})+)*(?:-x(?:-[a-z\d]{1,8})+)?$',
    re.I,
)


class LocaleRegistry:
    """
    语言注册与规范化工具类
    """

    @staticmethod
    def normalize_locale(value: str, *, preference: bool = False) -> str:
        """
        校验并规范化语言标识

        :param value: 原始语言标识，兼容下划线分隔形式
        :param preference: 是否允许表示跟随设备的 auto 偏好
        :return: 规范化后的语言标识或 auto
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
        按语言标识或显式别名匹配已注册语言

        :param value: 待匹配的语言标识
        :return: 已注册的语言标识，无法匹配时返回 None
        """
        try:
            code = cls.normalize_locale(value)
        except ValueError:
            return None
        if code in LOCALES:
            return code
        return next((key for key, entry in LOCALES.items() if code in entry['aliases']), None)

    @staticmethod
    def fallback_chain(code: str) -> tuple[str, ...]:
        """
        生成去重后的语言回退链并校验循环配置

        :param code: 已注册的语言标识
        :return: 包含基准语言的回退链
        """
        result = []

        def visit(item: str, stack: tuple[str, ...] = ()) -> None:
            if item in stack or item not in LOCALES:
                raise ValueError('Invalid locale fallback configuration')
            if item not in result:
                result.append(item)
                for fallback in LOCALES[item]['fallback']:
                    visit(fallback, (*stack, item))

        visit(code)
        visit(I18nConfig.SOURCE_LOCALE)
        return tuple(result)


for _code in LOCALES:
    LocaleRegistry.fallback_chain(_code)
