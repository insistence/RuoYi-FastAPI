from typing import Any

from common.context import RequestContext
from config.env import I18nConfig
from i18n.registry import LOCALES, LocaleRegistry


class TranslationUtil:
    """
    菜单和字典译文工具类
    """

    @staticmethod
    def validate(value: Any, max_length: int) -> dict[str, str | None]:
        """
        校验译文补丁，允许保存尚未启用的语言

        :param value: 语言标识到译文的映射，空值表示没有译文补丁
        :param max_length: 单个译文的最大长度
        :return: 规范化语言标识后的译文补丁
        """
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError('Translations must be an object')
        result = {}
        for locale, translation in value.items():
            code = LocaleRegistry.normalize_locale(locale)
            if code == 'auto':
                raise ValueError('Automatic preference is not a translation locale')
            if code == I18nConfig.SOURCE_LOCALE:
                raise ValueError('Edit the original name for the source locale')
            if code in result:
                raise ValueError('Duplicate translation locale')
            if translation is not None and (
                not isinstance(translation, str) or not translation.strip() or len(translation) > max_length
            ):
                raise ValueError(f'Translation must be non-empty and at most {max_length} characters')
            result[code] = translation
        return result

    @staticmethod
    def merge(current: dict[str, str] | None, patch: dict[str, str | None]) -> dict[str, str]:
        """
        合并语言补丁，空映射保留已有译文，单项空值删除对应语言

        :param current: 数据库中的最新译文
        :param patch: 本次提交的语言补丁
        :return: 合并后的新映射，不修改输入对象
        """
        result = dict(current or {})
        for locale, translation in patch.items():
            if translation is None:
                result.pop(locale, None)
            else:
                result[locale] = translation
        return result

    @staticmethod
    def resolve(original: str, translations: dict[str, str] | None, *, locale: str | None = None) -> str:
        """
        按当前请求语言解析数据库译文，旧客户端保留原名称

        :param original: 基准语言名称
        :param translations: 数据库译文
        :param locale: 显式指定语言，省略时使用当前请求语言
        :return: 译文或基准语言名称
        """
        context = RequestContext.get_current_locale()
        if locale is None and context.version != 'v1':
            return original
        code = locale or context.locale
        if code not in LOCALES:
            code = I18nConfig.i18n_default_locale
        for fallback in LocaleRegistry.fallback_chain(code):
            if fallback == I18nConfig.SOURCE_LOCALE:
                return original
            value = (translations or {}).get(fallback)
            if isinstance(value, str) and value.strip():
                return value
        return original
