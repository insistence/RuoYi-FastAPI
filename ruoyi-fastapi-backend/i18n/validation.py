import math
from typing import Any

from i18n.translator import I18nUtil

# 仅返回错误类型声明的公开约束参数，不序列化校验器异常对象。
_ERROR_MESSAGES = {
    'missing': ('validation.required', ()),
    'string_type': ('validation.string', ()),
    'string_too_short': ('validation.stringTooShort', ('min_length',)),
    'string_too_long': ('validation.stringTooLong', ('max_length',)),
    'string_pattern_mismatch': ('validation.pattern', ()),
    'int_type': ('validation.integer', ()),
    'int_parsing': ('validation.integer', ()),
    'int_from_float': ('validation.integer', ()),
    'float_type': ('validation.number', ()),
    'float_parsing': ('validation.number', ()),
    'finite_number': ('validation.finiteNumber', ()),
    'bool_type': ('validation.boolean', ()),
    'bool_parsing': ('validation.boolean', ()),
    'greater_than': ('validation.greaterThan', ('gt',)),
    'greater_than_equal': ('validation.greaterThanEqual', ('ge',)),
    'less_than': ('validation.lessThan', ('lt',)),
    'less_than_equal': ('validation.lessThanEqual', ('le',)),
    'multiple_of': ('validation.multipleOf', ('multiple_of',)),
    'literal_error': ('validation.expected', ('expected',)),
    'enum': ('validation.expected', ('expected',)),
    'list_type': ('validation.list', ()),
    'dict_type': ('validation.object', ()),
    'date_type': ('validation.date', ()),
    'date_parsing': ('validation.date', ()),
    'date_from_datetime_parsing': ('validation.date', ()),
    'date_from_datetime_inexact': ('validation.date', ()),
    'datetime_type': ('validation.datetime', ()),
    'datetime_parsing': ('validation.datetime', ()),
    'datetime_from_date_parsing': ('validation.datetime', ()),
    'time_type': ('validation.time', ()),
    'time_parsing': ('validation.time', ()),
    'uuid_parsing': ('validation.uuid', ()),
    'uuid_type': ('validation.uuid', ()),
    'json_invalid': ('validation.json', ()),
    'json_type': ('validation.json', ()),
}


class ValidationMessageUtil:
    """
    原生 422 校验错误翻译工具，保留字段定位和公开约束
    """

    @staticmethod
    def localize(error: dict[str, Any]) -> dict[str, Any]:
        """
        翻译支持的校验错误，未知类型使用通用提示并保留字段路径

        :param error: 原生校验错误信息
        :return: 包含译文和消息元数据的校验错误
        """
        key, names = _ERROR_MESSAGES.get(error['type'], ('validation.invalid', ()))
        context = error.get('ctx') or {}
        params = {
            name: context[name]
            for name in names
            if name in context
            and isinstance(context[name], (str, int, float))
            and not isinstance(context[name], bool)
            and (not isinstance(context[name], float) or math.isfinite(context[name]))
        }
        if len(params) != len(names):
            key, params = 'validation.invalid', {}
        # 不回显可能含敏感值的 input，也不将 ctx.error 转换为字符串。
        result = {
            'loc': error['loc'],
            'type': error['type'],
            'msg': I18nUtil.translate(key, params),
            'msgKey': key,
            'msgParams': params,
        }
        if params:
            result['ctx'] = dict(params)
        return result
