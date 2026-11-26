import re
import sys

if sys.version_info >= (3, 13):
    from ntpath import isreserved as is_windows_reserved
else:
    from pathlib import PureWindowsPath

    def is_windows_reserved(name: str) -> bool:
        """
        按 Windows 规则识别保留路径名。

        :param name: 用于查找或标识当前对象的名称
        :return: 是否按 Windows 规则识别保留路径名
        """
        return PureWindowsPath(name).is_reserved()


PLUGIN_ID_PATTERN_TEXT = r'[a-z][a-z0-9_]{1,63}'
PLUGIN_ID_PATTERN = re.compile(rf'^{PLUGIN_ID_PATTERN_TEXT}$')


def validate_plugin_id_value(plugin_id: str, *, field_name: str = '插件ID') -> str:
    """
    校验插件 ID。

    :param plugin_id: 插件 ID
    :param field_name: 错误提示中的字段名称
    :return: 校验后的插件 ID
    :raises ValueError: 插件标识的长度、首字符或字符集不合法
    """
    if not PLUGIN_ID_PATTERN.match(plugin_id):
        raise ValueError(f'{field_name}必须以小写字母开头，且只能包含小写字母、数字和下划线，长度为2-64')
    return plugin_id


def escape_sql_like(value: str) -> str:
    """
    转义 SQL LIKE 模式中的通配符。

    :param value: 原始字面量
    :return: 可安全拼接到 LIKE 模式中的字面量
    """
    return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
