from types import SimpleNamespace
from typing import Any, TypeVar

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ValidationError
from sqlalchemy import select

from plugins.core.runtime.health import PluginHealthContext
from plugins.core.sdk import PluginDefinition, PluginHostContext, PluginRequestContext
from plugins.core.sdk.asgi import plugin_endpoint

from . import service
from .models import TaskIdentifier, TaskInput, TaskQuery, tasks

VERSION = '1.1.0'
_runtime = SimpleNamespace(session_factory=None)


_Model = TypeVar('_Model', bound=BaseModel)


def _validate(model: type[_Model], values: dict[str, Any]) -> _Model:
    """
    校验 SDK 请求快照中的路径和查询参数。

    :param model: 目标参数模型
    :param values: 原始参数字段
    :return: 已校验的模型；无效输入返回 HTTP 422
    :raises HTTPException: 路径或查询参数未通过模型校验
    """
    try:
        return model.model_validate(values)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=exc.errors(include_input=False, include_context=False, include_url=False),
        ) from exc


def _task_id(context: PluginRequestContext) -> str:
    """
    读取 SDK 已提取的任务路径参数。

    :param context: 含 HTTP 请求快照的宿主上下文
    :return: 已校验的任务标识
    """
    return _validate(TaskIdentifier, {'id': context.http_request.path_params['task_id']}).id


async def info(context: PluginRequestContext) -> dict[str, Any]:
    return {'pluginId': context.host.plugin_id, 'version': VERSION, 'canWrite': service.can_write(context)}


async def list_tasks(context: PluginRequestContext) -> dict[str, Any]:
    if any(len(values) != 1 for values in context.http_request.query.values()):
        raise HTTPException(status_code=422, detail='查询参数不能重复')
    query = _validate(TaskQuery, {key: values[0] for key, values in context.http_request.query.items()})
    return await service.list_tasks(context, query)


async def get_task(context: PluginRequestContext) -> dict[str, Any]:
    return await service.get_task(context, _task_id(context))


async def create_task(context: PluginRequestContext) -> dict[str, Any]:
    return await service.create_task(context, context.http_request.body)


async def update_task(context: PluginRequestContext) -> dict[str, Any]:
    return await service.update_task(context, _task_id(context), context.http_request.body)


async def delete_task(context: PluginRequestContext) -> dict[str, bool]:
    return await service.delete_task(context, _task_id(context))


def create_plugin(host: PluginHostContext) -> PluginDefinition:
    """
    声明使用宿主事务能力的任务插件，不在启动时创建表。

    :param host: 宿主提供的插件能力
    :return: 仅挂载相对 API 的 ASGI 插件声明
    """
    # 仅保存宿主授予的会话工厂，健康检查自行开关会话，不保留请求会话。
    _runtime.session_factory = host.session_factory

    def create_app(context: PluginHostContext) -> FastAPI:
        """
        创建任务管理子应用，各接口独立声明读写权限。

        :param context: 宿主提供的插件能力
        :return: 任务管理 ASGI 子应用
        """
        app = FastAPI(title='持久化任务示例', docs_url=None, redoc_url=None, openapi_url=None)
        app.add_api_route(
            '/api/info',
            plugin_endpoint(info, permission='task_demo:view'),
            summary='查询任务插件信息',
            description='返回插件标识、版本，以及当前用户是否可以修改任务。',
            methods=['GET'],
        )
        app.add_api_route(
            '/api/tasks',
            plugin_endpoint(list_tasks, permission='task_demo:view'),
            summary='分页查询任务',
            description='按完成状态筛选任务，并返回指定页的任务记录。',
            methods=['GET'],
        )
        app.add_api_route(
            '/api/tasks/{task_id}',
            plugin_endpoint(get_task, permission='task_demo:view'),
            summary='查询任务详情',
            description='按路径中的任务标识读取单条任务记录。',
            methods=['GET'],
        )
        app.add_api_route(
            '/api/tasks',
            plugin_endpoint(create_task, permission='task_demo:write', body_model=TaskInput, max_body_bytes=8192),
            summary='创建任务',
            description='校验任务标题、内容、状态与优先级，保存并返回新建的任务。',
            methods=['POST'],
            status_code=201,
        )
        app.add_api_route(
            '/api/tasks/{task_id}',
            plugin_endpoint(update_task, permission='task_demo:write', body_model=TaskInput, max_body_bytes=8192),
            summary='更新任务',
            description='按任务标识替换标题、内容、状态和优先级，并返回更新结果。',
            methods=['PUT'],
        )
        app.add_api_route(
            '/api/tasks/{task_id}',
            plugin_endpoint(delete_task, permission='task_demo:write'),
            summary='删除任务',
            description='删除指定标识的任务并返回删除结果。',
            methods=['DELETE'],
        )
        return app

    return PluginDefinition(app_factory=create_app)


async def health(context: PluginHealthContext) -> dict[str, Any]:
    """
    只读验证任务表及当前版本新增字段，不执行 DDL 或修复。

    :param context: 宿主健康检查上下文
    :return: 明确包含布尔 ok 的健康结果
    """
    statement = select(tasks).limit(1)
    try:
        if context.query_db is not None:
            await context.query_db.execute(statement)
        else:
            if _runtime.session_factory is None:
                return {'ok': False, 'status': 'unavailable', 'message': '宿主未提供数据库检查会话'}
            async with _runtime.session_factory() as db:
                await db.execute(statement)
    except Exception:
        return {'ok': False, 'status': 'unhealthy', 'message': '任务表或 priority 字段不可读，请检查迁移记录'}
    return {'ok': True, 'status': 'healthy', 'message': '任务表及 priority 字段可读'}
