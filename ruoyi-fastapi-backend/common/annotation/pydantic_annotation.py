import inspect
from typing import TYPE_CHECKING, TypeVar

from fastapi import Form, Query
from pydantic import BaseModel

if TYPE_CHECKING:
    from pydantic.fields import FieldInfo

BaseModelVar = TypeVar('BaseModelVar', bound=BaseModel)


def as_query(cls: type[BaseModelVar]) -> type[BaseModelVar]:
    """
    pydantic模型查询参数装饰器，将pydantic模型用于接收查询参数。

    :param cls: 将查询参数转换到的模型类
    :return: 将查询参数转换到的模型类
    """
    new_parameters = []

    for model_field in cls.model_fields.values():
        model_field: FieldInfo

        if not model_field.is_required():
            new_parameters.append(
                inspect.Parameter(
                    model_field.alias,
                    inspect.Parameter.POSITIONAL_ONLY,
                    default=Query(default=model_field.default, description=model_field.description),
                    annotation=model_field.annotation,
                )
            )
        else:
            new_parameters.append(
                inspect.Parameter(
                    model_field.alias,
                    inspect.Parameter.POSITIONAL_ONLY,
                    default=Query(..., description=model_field.description),
                    annotation=model_field.annotation,
                )
            )

    async def as_query_func(**data) -> type[BaseModelVar]:
        """
        用解析出的查询参数构建模型实例。

        :param data: 调用方按名称传入的附加选项
        :return: 由查询参数创建的模型实例
        """
        return cls(**data)

    sig = inspect.signature(as_query_func)
    sig = sig.replace(parameters=new_parameters)
    as_query_func.__signature__ = sig
    cls.as_query = as_query_func
    return cls


def as_form(cls: type[BaseModelVar]) -> type[BaseModelVar]:
    """
    pydantic模型表单参数装饰器，将pydantic模型用于接收表单参数。

    :param cls: 将表单字段转换到的模型类
    :return: 将表单字段转换到的模型类
    """
    new_parameters = []

    for model_field in cls.model_fields.values():
        model_field: FieldInfo

        if not model_field.is_required():
            new_parameters.append(
                inspect.Parameter(
                    model_field.alias,
                    inspect.Parameter.POSITIONAL_ONLY,
                    default=Form(default=model_field.default, description=model_field.description),
                    annotation=model_field.annotation,
                )
            )
        else:
            new_parameters.append(
                inspect.Parameter(
                    model_field.alias,
                    inspect.Parameter.POSITIONAL_ONLY,
                    default=Form(..., description=model_field.description),
                    annotation=model_field.annotation,
                )
            )

    async def as_form_func(**data) -> type[BaseModelVar]:
        """
        用解析出的表单字段构建模型实例。

        :param data: 调用方按名称传入的附加选项
        :return: 由表单字段创建的模型实例
        """
        return cls(**data)

    sig = inspect.signature(as_form_func)
    sig = sig.replace(parameters=new_parameters)
    as_form_func.__signature__ = sig
    cls.as_form = as_form_func
    return cls
