from fastapi import Request

from common.context import RequestContext
from config.env import AppConfig
from exceptions.exception import PermissionException


class DependencyUtil:
    """
    依赖项工具类
    """

    @classmethod
    def get_request_path(cls, request: Request) -> str:
        """
        获取不含部署前缀的应用内请求路径

        :param request: 当前请求对象
        :return: 应用内请求路径
        """
        scope = getattr(request, 'scope', {})
        # 使用路由匹配的ASGI路径，避免URL解析截断或丢弃路径字符。
        path = scope.get('path')
        if path is None:
            path = request.url.path
        root_path = (scope.get('root_path') or '').rstrip('/')
        if not root_path and scope.get('route') is None:
            # 直接调用依赖时可能没有ASGI路由上下文，保留配置前缀的处理。
            root_path = (AppConfig.app_root_path or '').rstrip('/')
        if root_path and (path == root_path or path.startswith(f'{root_path}/')):
            return path[len(root_path) :]
        return path

    @classmethod
    def check_exclude_routes(cls, request: Request, err_msg: str = '当前路由不在认证规则内，不可使用该依赖项') -> None:
        """
        检查路径和方法是否匹配排除路由模式

        :param request: 请求对象
        :param err_msg: 错误信息
        :return: None
        """
        # 获取当前请求路径和方法
        path = cls.get_request_path(request)
        method = request.method.upper()

        # 获取编译后的排除路由模式列表
        exclude_patterns = RequestContext.get_current_exclude_patterns()

        # 检查当前路由是否在排除路由列表中
        if path and method and exclude_patterns:
            for item in exclude_patterns:
                pattern = item['pattern']
                exclude_methods = item['methods']
                ignore_paths = item['ignore_paths']

                # 检查当前路径是否在忽略列表中
                if path in ignore_paths:
                    continue

                # 检查路径是否匹配，并且methods为空列表（匹配所有方法）或者当前方法在允许列表中
                if pattern.fullmatch(path) and (not exclude_methods or method in exclude_methods):
                    raise PermissionException(data='', message=err_msg)
