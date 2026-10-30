import re
from collections.abc import Mapping

from starlette.datastructures import MutableHeaders

from common.context import LocaleContext
from config.env import I18nConfig
from i18n.registry import LocaleRegistry

_MAX_HEADER_LENGTH = 1024
_MAX_LANGUAGE_RANGES = 20


class LocaleUtil:
    """
    请求语言协商与响应头工具类
    """

    @staticmethod
    def negotiate_language(header: str) -> str:
        """
        根据请求头权重协商有效语言

        :param header: Accept-Language 请求头原始值
        :return: 匹配到的已注册语言，无法匹配时返回默认语言
        """
        if len(header) > _MAX_HEADER_LENGTH:
            return I18nConfig.i18n_default_locale
        parts = header.split(',')
        if len(parts) > _MAX_LANGUAGE_RANGES:
            return I18nConfig.i18n_default_locale
        candidates = []
        for index, part in enumerate(parts):
            language, separator, quality = part.strip().partition(';')
            weight = 1.0
            if separator:
                match = re.fullmatch(r'\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*', quality)
                if not match:
                    continue
                weight = float(match[1])
            if weight > 0:
                candidates.append((-weight, index, language.strip()))
        for _, _, candidate in sorted(candidates):
            matched = I18nConfig.i18n_default_locale if candidate == '*' else LocaleRegistry.match_locale(candidate)
            if matched:
                return matched
        return I18nConfig.i18n_default_locale

    @classmethod
    def context_from_headers(cls, headers: Mapping[str, str]) -> LocaleContext:
        """
        根据能力版本和请求语言构造上下文

        :param headers: 支持按小写名称读取的请求头集合
        :return: 当前请求的语言上下文
        """
        if headers.get('x-i18n-version') != '1':
            return LocaleContext()
        return LocaleContext(cls.negotiate_language(headers.get('accept-language', '')), 'v1')

    @staticmethod
    def add_locale_headers(headers: MutableHeaders, context: LocaleContext) -> None:
        """
        追加语言响应头并保留原有 Vary 配置

        :param headers: 可修改的响应头集合
        :param context: 当前请求的语言上下文
        """
        vary = [part.strip() for part in headers.get('vary', '').split(',') if part.strip()]
        if '*' not in vary:
            for field in ('Accept-Language', 'X-I18n-Version'):
                if field.lower() not in {part.lower() for part in vary}:
                    vary.append(field)
            headers['vary'] = ', '.join(vary)
        if context.version == 'v1':
            headers['content-language'] = context.locale
            headers['x-i18n-version'] = '1'
