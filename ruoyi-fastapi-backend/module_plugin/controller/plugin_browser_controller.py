from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from common.aspect.db_session import DBSessionDependency
from common.aspect.pre_auth import CurrentUserDependency
from common.router import APIRouterPro
from common.vo import DataResponseModel
from i18n.message import I18nMessage
from module_admin.entity.vo.user_vo import CurrentUserModel
from module_admin.service.login_service import oauth2_scheme
from plugins.core.runtime.browser_session import COOKIE_NAME_PREFIX, issue_browser_session, plugin_browser_base
from plugins.core.runtime.explicit import ExplicitPluginRuntime
from utils.response_util import ResponseUtil

plugin_browser_controller = APIRouterPro(prefix='/plugin/runtime', tags=['插件浏览器会话'])


@plugin_browser_controller.post(
    '/{plugin_id}/session',
    summary='创建插件浏览器会话接口',
    description='用于为当前登录用户创建插件页面访问会话，并返回访问地址和防跨站请求令牌',
    response_model=DataResponseModel[dict],
)
async def create_plugin_browser_session(
    request: Request,
    plugin_id: Annotated[str, Path(description='插件ID')],
    current_user: Annotated[CurrentUserModel, CurrentUserDependency()],
    token: Annotated[str, Depends(oauth2_scheme)],
    query_db: Annotated[AsyncSession, DBSessionDependency()],
) -> Response:
    runtime = getattr(request.app.state, 'plugin_explicit_runtime', None)
    loaded = runtime.loaded.get(plugin_id) if isinstance(runtime, ExplicitPluginRuntime) else None
    if loaded is None or loaded.plugin.discovered_plugin.manifest.frontend.delivery.type != 'bundle':
        raise HTTPException(status_code=404, detail=I18nMessage('插件页面不存在', msg_key='plugin.session.pageMissing'))
    if not loaded.active or loaded.lifespan is None or not loaded.lifespan.ready:
        raise HTTPException(status_code=503, detail=I18nMessage('插件页面尚未就绪', msg_key='plugin.session.notReady'))
    try:
        if not await runtime.route_state_gateway.is_plugin_enabled(query_db, plugin_id):
            raise HTTPException(status_code=403, detail=I18nMessage('插件未启用', msg_key='plugin.disabled'))
        runtime._request_context(loaded, current_user)
        cookie, csrf, seconds = await issue_browser_session(
            request,
            plugin_id=plugin_id,
            version=loaded.plugin.discovered_plugin.manifest.version,
            main_token=token,
            user_id=current_user.user.user_id,
        )
    except PermissionError as exc:
        detail = (
            exc.args[0]
            if exc.args and isinstance(exc.args[0], I18nMessage)
            else I18nMessage(str(exc), msg_key='plugin.session.forbidden')
        )
        raise HTTPException(status_code=403, detail=detail) from exc
    except LookupError as exc:
        detail = (
            exc.args[0]
            if exc.args and isinstance(exc.args[0], I18nMessage)
            else I18nMessage(str(exc), msg_key='plugin.session.invalid')
        )
        raise HTTPException(status_code=401, detail=detail) from exc
    base = plugin_browser_base(request, plugin_id)
    response = ResponseUtil.success(
        data={
            'pluginId': plugin_id,
            'uiBase': f'{base}ui/',
            'apiBase': f'{base}api/',
            'bridgeVersion': 1,
            'csrfToken': csrf,
            'expiresIn': seconds,
        },
        headers={'Cache-Control': 'no-store'},
    )
    response.set_cookie(
        f'{COOKIE_NAME_PREFIX}{plugin_id}',
        cookie,
        max_age=seconds,
        path=base,
        httponly=True,
        secure=request.url.scheme == 'https',
        samesite='strict',
    )
    return response
