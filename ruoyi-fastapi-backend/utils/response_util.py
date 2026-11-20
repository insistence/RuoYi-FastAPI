from collections.abc import Mapping
from datetime import datetime
from typing import Any

from fastapi import status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from common.constant import HttpStatusConstant
from common.context import RequestContext
from i18n.message import I18nMessage
from i18n.translator import I18nUtil
from utils.time_util import TimezoneUtil


class ResponseUtil:
    """
    响应工具类
    """

    @staticmethod
    def _json_content(result: dict[str, Any]) -> Any:
        """
        序列化响应时刻及显式标记的国际化消息

        :param result: 待返回的响应内容
        :return: 可供JSON响应使用的数据
        """
        context = RequestContext.get_current_locale()
        return jsonable_encoder(
            result,
            custom_encoder={
                datetime: TimezoneUtil.format_rfc3339,
                I18nMessage: lambda value: str(I18nUtil.message_fields(value, context=context)['msg']),
            },
        )

    @classmethod
    def success(  # noqa: PLR0913 - 保留已有位置参数，扩展语义仅允许关键字传入。
        cls,
        msg: str | None = None,
        data: Any | None = None,
        rows: Any | None = None,
        dict_content: dict | None = None,
        model_content: BaseModel | None = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> Response:
        """
        成功响应方法

        :param msg: 可选，自定义成功响应信息
        :param data: 可选，成功响应结果中属性为data的值
        :param rows: 可选，成功响应结果中属性为rows的值
        :param dict_content: 可选，dict类型，成功响应结果中自定义属性的值
        :param model_content: 可选，BaseModel类型，成功响应结果中自定义属性的值
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param msg_key: 可选，优先使用的语义消息标识
        :param msg_params: 可选，可公开的基础类型插值参数
        :param domain: 可选，已注册的词库域；默认使用消息元数据或 core
        :param count: 可选，必须与 plural_key 成对传入的非负整数
        :param plural_key: 可选，PO 中的复数语义标识
        :return: 成功响应结果
        """
        fields = I18nUtil.message_fields(
            msg,
            msg_key=msg_key,
            msg_params=msg_params,
            domain=domain,
            count=count,
            plural_key=plural_key,
            default_key='common.success',
        )
        result = {'code': HttpStatusConstant.SUCCESS, **fields}

        if data is not None:
            result['data'] = data
        if rows is not None:
            result['rows'] = rows
        if dict_content is not None:
            result.update(dict_content)
        if model_content is not None:
            result.update(model_content.model_dump(by_alias=True))

        if msg_key is not None:
            result.update(fields)

        result.update({'success': True, 'time': TimezoneUtil.utc_now()})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=cls._json_content(result),
            headers=headers,
            media_type=media_type,
            background=background,
        )

    @classmethod
    def failure(  # noqa: PLR0913 - 保留已有位置参数，扩展语义仅允许关键字传入。
        cls,
        msg: str | None = None,
        data: Any | None = None,
        rows: Any | None = None,
        dict_content: dict | None = None,
        model_content: BaseModel | None = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> Response:
        """
        失败响应方法

        :param msg: 可选，自定义失败响应信息
        :param data: 可选，失败响应结果中属性为data的值
        :param rows: 可选，失败响应结果中属性为rows的值
        :param dict_content: 可选，dict类型，失败响应结果中自定义属性的值
        :param model_content: 可选，BaseModel类型，失败响应结果中自定义属性的值
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param msg_key: 可选，优先使用的语义消息标识
        :param msg_params: 可选，可公开的基础类型插值参数
        :param domain: 可选，已注册的词库域；默认使用消息元数据或 core
        :param count: 可选，必须与 plural_key 成对传入的非负整数
        :param plural_key: 可选，PO 中的复数语义标识
        :return: 失败响应结果
        """
        fields = I18nUtil.message_fields(
            msg,
            msg_key=msg_key,
            msg_params=msg_params,
            domain=domain,
            count=count,
            plural_key=plural_key,
            default_key='common.failure',
        )
        result = {'code': HttpStatusConstant.WARN, **fields}

        if data is not None:
            result['data'] = data
        if rows is not None:
            result['rows'] = rows
        if dict_content is not None:
            result.update(dict_content)
        if model_content is not None:
            result.update(model_content.model_dump(by_alias=True))

        if msg_key is not None:
            result.update(fields)

        result.update({'success': False, 'time': TimezoneUtil.utc_now()})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=cls._json_content(result),
            headers=headers,
            media_type=media_type,
            background=background,
        )

    @classmethod
    def unauthorized(  # noqa: PLR0913 - 保留已有位置参数，扩展语义仅允许关键字传入。
        cls,
        msg: str | None = None,
        data: Any | None = None,
        rows: Any | None = None,
        dict_content: dict | None = None,
        model_content: BaseModel | None = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> Response:
        """
        未认证响应方法

        :param msg: 可选，自定义未认证响应信息
        :param data: 可选，未认证响应结果中属性为data的值
        :param rows: 可选，未认证响应结果中属性为rows的值
        :param dict_content: 可选，dict类型，未认证响应结果中自定义属性的值
        :param model_content: 可选，BaseModel类型，未认证响应结果中自定义属性的值
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param msg_key: 可选，优先使用的语义消息标识
        :param msg_params: 可选，可公开的基础类型插值参数
        :param domain: 可选，已注册的词库域；默认使用消息元数据或 core
        :param count: 可选，必须与 plural_key 成对传入的非负整数
        :param plural_key: 可选，PO 中的复数语义标识
        :return: 未认证响应结果
        """
        fields = I18nUtil.message_fields(
            msg,
            msg_key=msg_key,
            msg_params=msg_params,
            domain=domain,
            count=count,
            plural_key=plural_key,
            default_key='common.unauthorized',
        )
        result = {'code': HttpStatusConstant.UNAUTHORIZED, **fields}

        if data is not None:
            result['data'] = data
        if rows is not None:
            result['rows'] = rows
        if dict_content is not None:
            result.update(dict_content)
        if model_content is not None:
            result.update(model_content.model_dump(by_alias=True))

        if msg_key is not None:
            result.update(fields)

        result.update({'success': False, 'time': TimezoneUtil.utc_now()})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=cls._json_content(result),
            headers=headers,
            media_type=media_type,
            background=background,
        )

    @classmethod
    def forbidden(  # noqa: PLR0913 - 保留已有位置参数，扩展语义仅允许关键字传入。
        cls,
        msg: str | None = None,
        data: Any | None = None,
        rows: Any | None = None,
        dict_content: dict | None = None,
        model_content: BaseModel | None = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> Response:
        """
        未授权响应方法

        :param msg: 可选，自定义未授权响应信息
        :param data: 可选，未授权响应结果中属性为data的值
        :param rows: 可选，未授权响应结果中属性为rows的值
        :param dict_content: 可选，dict类型，未授权响应结果中自定义属性的值
        :param model_content: 可选，BaseModel类型，未授权响应结果中自定义属性的值
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param msg_key: 可选，优先使用的语义消息标识
        :param msg_params: 可选，可公开的基础类型插值参数
        :param domain: 可选，已注册的词库域；默认使用消息元数据或 core
        :param count: 可选，必须与 plural_key 成对传入的非负整数
        :param plural_key: 可选，PO 中的复数语义标识
        :return: 未授权响应结果
        """
        fields = I18nUtil.message_fields(
            msg,
            msg_key=msg_key,
            msg_params=msg_params,
            domain=domain,
            count=count,
            plural_key=plural_key,
            default_key='common.forbidden',
        )
        result = {'code': HttpStatusConstant.FORBIDDEN, **fields}

        if data is not None:
            result['data'] = data
        if rows is not None:
            result['rows'] = rows
        if dict_content is not None:
            result.update(dict_content)
        if model_content is not None:
            result.update(model_content.model_dump(by_alias=True))

        if msg_key is not None:
            result.update(fields)

        result.update({'success': False, 'time': TimezoneUtil.utc_now()})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=cls._json_content(result),
            headers=headers,
            media_type=media_type,
            background=background,
        )

    @classmethod
    def error(  # noqa: PLR0913 - 保留已有位置参数，扩展语义仅允许关键字传入。
        cls,
        msg: str | None = None,
        data: Any | None = None,
        rows: Any | None = None,
        dict_content: dict | None = None,
        model_content: BaseModel | None = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> Response:
        """
        错误响应方法

        :param msg: 可选，自定义错误响应信息
        :param data: 可选，错误响应结果中属性为data的值
        :param rows: 可选，错误响应结果中属性为rows的值
        :param dict_content: 可选，dict类型，错误响应结果中自定义属性的值
        :param model_content: 可选，BaseModel类型，错误响应结果中自定义属性的值
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param msg_key: 可选，优先使用的语义消息标识
        :param msg_params: 可选，可公开的基础类型插值参数
        :param domain: 可选，已注册的词库域；默认使用消息元数据或 core
        :param count: 可选，必须与 plural_key 成对传入的非负整数
        :param plural_key: 可选，PO 中的复数语义标识
        :return: 错误响应结果
        """
        fields = I18nUtil.message_fields(
            msg,
            msg_key=msg_key,
            msg_params=msg_params,
            domain=domain,
            count=count,
            plural_key=plural_key,
            default_key='common.error',
        )
        result = {'code': HttpStatusConstant.ERROR, **fields}

        if data is not None:
            result['data'] = data
        if rows is not None:
            result['rows'] = rows
        if dict_content is not None:
            result.update(dict_content)
        if model_content is not None:
            result.update(model_content.model_dump(by_alias=True))

        if msg_key is not None:
            result.update(fields)

        result.update({'success': False, 'time': TimezoneUtil.utc_now()})

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=cls._json_content(result),
            headers=headers,
            media_type=media_type,
            background=background,
        )

    @classmethod
    def too_many_requests(  # noqa: PLR0913 - 保留已有位置参数，扩展语义仅允许关键字传入。
        cls,
        msg: str | None = None,
        data: Any | None = None,
        rows: Any | None = None,
        dict_content: dict | None = None,
        model_content: BaseModel | None = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        *,
        msg_key: str | None = None,
        msg_params: dict | None = None,
        domain: str | None = None,
        count: int | None = None,
        plural_key: str | None = None,
    ) -> Response:
        """
        接口限流响应方法

        :param msg: 可选，自定义限流响应信息
        :param data: 可选，限流响应结果中属性为data的值
        :param rows: 可选，限流响应结果中属性为rows的值
        :param dict_content: 可选，dict类型，限流响应结果中自定义属性的值
        :param model_content: 可选，BaseModel类型，限流响应结果中自定义属性的值
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param msg_key: 可选，优先使用的语义消息标识
        :param msg_params: 可选，可公开的基础类型插值参数
        :param domain: 可选，已注册的词库域；默认使用消息元数据或 core
        :param count: 可选，必须与 plural_key 成对传入的非负整数
        :param plural_key: 可选，PO 中的复数语义标识
        :return: 限流响应结果
        """
        fields = I18nUtil.message_fields(
            msg,
            msg_key=msg_key,
            msg_params=msg_params,
            domain=domain,
            count=count,
            plural_key=plural_key,
            default_key='common.rateLimited',
        )
        result = {'code': HttpStatusConstant.TOO_MANY_REQUESTS, **fields}

        if data is not None:
            result['data'] = data
        if rows is not None:
            result['rows'] = rows
        if dict_content is not None:
            result.update(dict_content)
        if model_content is not None:
            result.update(model_content.model_dump(by_alias=True))

        if msg_key is not None:
            result.update(fields)

        result.update({'success': False, 'time': TimezoneUtil.utc_now()})

        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=cls._json_content(result),
            headers=headers,
            media_type=media_type,
            background=background,
        )

    @classmethod
    def streaming(
        cls,
        *,
        data: Any = None,
        headers: Mapping[str, str] | None = None,
        media_type: str | None = None,
        background: BackgroundTask | None = None,
        status_code: int = status.HTTP_200_OK,
    ) -> Response:
        """
        流式响应方法

        :param data: 流式传输的内容
        :param headers: 可选，响应头信息
        :param media_type: 可选，响应结果媒体类型
        :param background: 可选，响应返回后执行的后台任务
        :param status_code: 响应状态码
        :return: 流式响应结果
        """
        return StreamingResponse(
            status_code=status_code,
            content=data,
            headers=headers,
            media_type=media_type,
            background=background,
        )
