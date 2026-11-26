import inspect
import keyword
from collections.abc import Callable
from typing import Any, Generic, TypeVar

from fastapi import Form, Query
from pydantic import BaseModel
from pydantic.fields import FieldInfo

BaseModelVar = TypeVar('BaseModelVar', bound=BaseModel)


class _ModelDependency(Generic[BaseModelVar]):
    """
    向 FastAPI 暴露模型字段的参数签名，并用请求数据构建模型。

    :ivar model: 用来校验请求数据的模型类
    :ivar __signature__: FastAPI 解析查询或表单参数时使用的签名
    """

    def __init__(self, model: type[BaseModelVar], parameter: Callable[..., FieldInfo]) -> None:
        """
        按模型字段声明生成依赖签名，保留外部参数名及默认值。

        :param model: 接收请求数据的模型类
        :param parameter: 创建查询或表单参数的 FastAPI 工厂
        """
        self.model = model
        parameters = []
        for name, field in model.model_fields.items():
            alias = field.alias or name
            argument = alias if alias.isidentifier() and not keyword.iskeyword(alias) else name
            parameters.append(
                inspect.Parameter(
                    argument,
                    inspect.Parameter.KEYWORD_ONLY,
                    default=parameter(
                        default=field.default,
                        default_factory=field.default_factory,
                        alias=alias,
                        description=field.description,
                    ),
                    annotation=field.annotation,
                )
            )
        self.__signature__ = inspect.Signature(parameters, return_annotation=model)

    async def __call__(self, **data: Any) -> BaseModelVar:
        """
        用 FastAPI 提取的字段构建并校验模型实例。

        :param data: 按字段名传入的查询参数或表单值
        :return: 通过校验的模型实例
        """
        return self.model.model_validate(data, by_name=True)


def as_query(cls: type[BaseModelVar]) -> type[BaseModelVar]:
    """
    将模型的查询参数依赖注册为类属性。

    :param cls: 接收查询参数的 Pydantic 模型类
    :return: 已注册查询参数依赖的模型类
    """
    return _register_dependency(cls, 'as_query', Query)


def as_form(cls: type[BaseModelVar]) -> type[BaseModelVar]:
    """
    将模型的表单参数依赖注册为类属性。

    :param cls: 接收表单参数的 Pydantic 模型类
    :return: 已注册表单参数依赖的模型类
    """
    return _register_dependency(cls, 'as_form', Form)


def _register_dependency(cls: type[BaseModelVar], name: str, parameter: Callable[..., FieldInfo]) -> type[BaseModelVar]:
    """
    将可异步调用的参数依赖绑定到模型类。

    :param cls: 接收请求数据的模型类
    :param name: 依赖在模型类上的属性名
    :param parameter: 创建 FastAPI 参数的工厂
    :return: 已注册依赖的模型类
    """
    setattr(cls, name, _ModelDependency(cls, parameter))
    return cls
