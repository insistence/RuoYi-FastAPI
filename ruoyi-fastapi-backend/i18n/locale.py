import logging
import re
from collections.abc import Mapping
from itertools import count

from starlette.datastructures import MutableHeaders

from common.context import LocaleContext
from config.env import I18nConfig
from i18n.registry import LocaleRegistry

_MAX_HEADER_LENGTH = 1024
_MAX_LANGUAGE_RANGES = 20
_WILDCARD_PRIORITY = 0
_FALLBACK_PRIORITY = 1
_LANGUAGE_RANGE_PRIORITY = 2
_EXACT_TAG_PRIORITY = 3
# 各进程分别累计两类超限情况，计数器不保存请求头内容。
_overlong_headers = count(1)
_excess_ranges = count(1)
logger = logging.getLogger(__name__)


class LocaleUtil:
    """请求语言协商与响应头工具类。"""

    @staticmethod
    def negotiate_language(header: str) -> str:
        """
        根据请求头权重协商有效语言。

        :param header: Accept-Language 请求头原始值
        :return: 匹配到的已注册语言，无法匹配时返回默认语言
        """
        default = I18nConfig.i18n_default_locale
        if len(header) > _MAX_HEADER_LENGTH:
            LocaleUtil._report_limit('length', next(_overlong_headers))
            return default
        parts = header.split(',')
        if len(parts) > _MAX_LANGUAGE_RANGES:
            LocaleUtil._report_limit('range_count', next(_excess_ranges))
            return default
        enabled = LocaleRegistry.enabled_locales()
        # 每种语言保留最具体的匹配（含 q=0），通配符只覆盖未被具体范围指定的语言。
        offers: dict[str, tuple[int, float, int]] = {}
        for index, part in enumerate(parts):
            language, separator, quality = part.strip().partition(';')
            weight = 1.0
            if separator:
                match = re.fullmatch(r'\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*', quality, re.I)
                if not match:
                    continue
                weight = float(match[1])
            language = language.strip()
            matches, specificity = LocaleUtil._match_range(language, enabled, excluded=weight == 0)
            for locale in matches:
                if locale not in offers or (specificity, weight) > offers[locale][:2]:
                    offers[locale] = (specificity, weight, index)
        acceptable = [locale for locale, (_, weight, _) in offers.items() if weight > 0]
        return min(
            acceptable,
            key=lambda code: (-offers[code][1], offers[code][2], code != default),
            default=default,
        )

    @staticmethod
    def _match_range(language: str, enabled: tuple[str, ...], *, excluded: bool) -> tuple[tuple[str, ...], int]:
        """
        匹配 Accept-Language 中的单个语言范围。

        :param language: 请求头中的语言标签或通配符
        :param enabled: 按注册顺序排列的已启用语言
        :param excluded: 该范围的权重是否为零，为零时也排除匹配的地区变体
        :return: 匹配的语言及其优先级，精确标签的优先级最高
        """
        if language == '*':
            return enabled, _WILDCARD_PRIORITY
        try:
            code = LocaleRegistry.normalize_locale(language)
        except ValueError:
            return (), _WILDCARD_PRIORITY
        matched = LocaleRegistry.match_locale(code)
        matches = tuple(item for item in enabled if item == matched or (excluded and item.startswith(f'{code}-')))
        if code == matched:
            return matches, _EXACT_TAG_PRIORITY
        if any(item.startswith(f'{code}-') for item in matches):
            return matches, _LANGUAGE_RANGE_PRIORITY
        return matches, _FALLBACK_PRIORITY

    @staticmethod
    def _report_limit(reason: str, total: int) -> None:
        """
        在累计次数为 2 的整数次幂时记录摘要，限制重复告警的频率。

        :param reason: 超限类别，对应请求头长度或语言范围数量
        :param total: 当前进程中该类别累计超限的次数
        """
        if total & (total - 1) == 0:
            logger.warning('i18n negotiation limit: reason=%s count=%d', reason, total)

    @classmethod
    def context_from_headers(cls, headers: Mapping[str, str]) -> LocaleContext:
        """
        根据 Accept-Language 请求头构造语言上下文。

        :param headers: 支持按小写名称读取的请求头集合
        :return: 当前请求的语言上下文
        """
        return LocaleContext(cls.negotiate_language(headers.get('accept-language', '')))

    @staticmethod
    def add_locale_headers(headers: MutableHeaders, context: LocaleContext) -> None:
        """
        追加语言响应头并保留原有 Vary 配置。

        :param headers: 可修改的响应头集合
        :param context: 当前请求的语言上下文
        """
        vary = [part.strip() for value in headers.getlist('vary') for part in value.split(',') if part.strip()]
        if '*' not in vary and 'accept-language' not in {part.lower() for part in vary}:
            headers['vary'] = ', '.join([*vary, 'Accept-Language'])
        headers['content-language'] = context.locale
