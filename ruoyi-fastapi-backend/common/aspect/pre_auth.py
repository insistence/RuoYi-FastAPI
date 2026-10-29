from fastapi import Depends, Request, params

from common.auth_policy import AuthRule, ExcludeRoute
from common.context import RequestContext
from exceptions.exception import LoginException
from module_admin.entity.vo.user_vo import CurrentUserModel
from module_admin.service.login_service import LoginService


class PreAuth(AuthRule):
    """
    登录认证前置校验依赖类
    """

    async def __call__(
        self,
        request: Request,
        current_user: CurrentUserModel | None = Depends(LoginService.get_current_user),
    ) -> CurrentUserModel | None:
        """
        保存前置认证规则和登录用户上下文

        :param request: 当前请求对象
        :param current_user: 登录认证依赖返回的当前用户
        :return: 当前用户信息
        """
        RequestContext.set_current_exclude_patterns(self.exclude_patterns)
        if current_user is not None:
            # 仅补充覆盖依赖未设置的上下文，不能用旧依赖结果覆盖重新鉴权后的权限。
            try:
                RequestContext.get_current_user()
            except LoginException:
                RequestContext.set_current_user(current_user)
        return current_user


def PreAuthDependency(exclude_routes: list[ExcludeRoute] | None = None) -> params.Depends:  # noqa: N802
    """
    登录认证前置校验依赖

    :param exclude_routes: 需要排除的路由列表，格式为：
                            [{'path': '/path1', 'methods': ['GET', 'POST']}, {'path': '/path2/{param}', 'methods': ['GET']}]
                            methods为空列表表示所有方法
    :return: 登录认证前置校验依赖
    """
    return Depends(PreAuth(exclude_routes))


def CurrentUserDependency() -> params.Depends:  # noqa: N802
    """
    当前登录用户信息依赖

    :return: 当前登录用户信息依赖
    """
    return Depends(LoginService.get_current_user)
