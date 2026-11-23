from importlib import import_module
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from i18n.translator import t

__all__ = ['t']


def __getattr__(name: str) -> Any:
    """
    按需加载翻译入口，避免配置加载时提前初始化翻译模块。

    :param name: 请求的模块属性名
    :return: 翻译入口函数
    :raises AttributeError: 请求的名称不是支持的翻译入口
    """
    if name == 't':
        return import_module('i18n.translator').t
    raise AttributeError(name)
