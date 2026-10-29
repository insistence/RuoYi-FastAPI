import re
from collections.abc import Callable, Iterator
from typing import Literal, TypedDict

from fastapi import Request
from fastapi.dependencies.models import Dependant
from fastapi.dependencies.utils import get_dependant

from utils.dependency_util import DependencyUtil


# 定义排除路由的字典结构
class ExcludeRoute(TypedDict, total=False):
    """
    排除路由的字典结构

    :param path: 路由路径（必填）
    :param methods: HTTP方法列表，空列表表示所有方法（可选，默认为[]）
    :param ignore_paths: 需要忽略的特定路径列表，即使匹配通配符也不排除（可选，默认为[]）
    """

    path: str
    methods: list[Literal['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']]
    ignore_paths: list[str]


class AuthRule:
    """
    登录认证排除规则
    """

    def __init__(self, exclude_routes: list[ExcludeRoute] | None = None) -> None:
        """
        初始化登录认证排除规则

        :param exclude_routes: 需要排除的路由列表，格式为：
                            [{'path': '/path1', 'methods': ['GET', 'POST']}, {'path': '/path2/{param}', 'methods': ['GET']}]
                            methods为空列表表示所有方法
        """
        self.exclude_routes = exclude_routes or []
        # 编译排除路径为正则表达式模式，并存储方法信息
        self.exclude_patterns = []

        for route in self.exclude_routes:
            # 使用TypedDict，确保路由字典包含path字段
            path = route.get('path', '')
            methods = route.get('methods', [])
            ignore_paths = route.get('ignore_paths', [])

            # 编译路径为正则表达式
            pattern = self._compile_path_pattern(path)
            self.exclude_patterns.append(
                {
                    'pattern': pattern,
                    'methods': [method.upper() for method in methods],
                    'original_path': path,
                    'ignore_paths': ignore_paths,
                }
            )

    def _compile_path_pattern(self, path: str) -> re.Pattern:
        """
        将FastAPI路径转换为正则表达式模式

        :param path: FastAPI路径（如 /configKey/{config_key}）
        :return: 编译后的正则表达式模式
        """
        # 将FastAPI路径参数转换为正则表达式
        # 例如：/configKey/{config_key} -> /configKey/[^/]+
        pattern_str = re.sub(r'\{[^}]+\}', r'[^/]+', path)
        # 添加开始和结束锚点，确保精确匹配
        return re.compile(f'^{pattern_str}$')

    def is_excluded(self, request: Request) -> bool:
        """
        判断当前请求是否排除登录认证

        :param request: 当前请求对象
        :return: 是否排除认证
        """
        path = DependencyUtil.get_request_path(request)
        method = request.method.upper()
        return self.is_excluded_path(path, method)

    def is_excluded_path(self, path: str, method: str) -> bool:
        """
        判断应用内路径和请求方法是否排除登录认证

        :param path: 应用内请求路径
        :param method: 请求方法
        :return: 是否排除认证
        """
        # 检查路径和方法是否匹配排除模式
        for item in self.exclude_patterns:
            pattern = item['pattern']
            exclude_methods = item['methods']
            ignore_paths = item['ignore_paths']

            # 检查当前路径是否在忽略列表中
            if path in ignore_paths:
                continue

            # 检查路径是否匹配，并且methods为空列表（匹配所有方法）或者当前方法在允许列表中
            if pattern.fullmatch(path) and (not exclude_methods or method in exclude_methods):
                return True

        return False


class AuthPolicy:
    """
    登录认证依赖判定
    """

    @classmethod
    def iter_auth_dependencies(
        cls,
        dependant: Dependant,
        auth_dependencies: tuple[Callable, ...],
        overrides: dict[Callable, Callable] | None = None,
    ) -> Iterator[AuthRule | None]:
        """
        遍历实际生效的登录认证声明

        :param dependant: 路由依赖
        :param auth_dependencies: 需要识别的认证入口和令牌依赖
        :param overrides: 应用覆盖的依赖
        :return: 前置认证规则对象，显式登录认证返回None
        """
        overrides = overrides or {}

        def visit(dependency: Dependant, rule: AuthRule | None = None) -> Iterator[AuthRule | None]:
            if dependency.call in overrides:
                # 按替换函数的实际声明判断，普通依赖覆盖不会使公开接口变为必需登录。
                dependency = get_dependant(
                    path=dependency.path or '',
                    call=overrides[dependency.call],
                    name=dependency.name,
                    own_oauth_scopes=dependency.own_oauth_scopes,
                    parent_oauth_scopes=dependency.parent_oauth_scopes,
                    use_cache=dependency.use_cache,
                    scope=dependency.scope,
                )
            if dependency.call in auth_dependencies:
                yield rule
                return
            if isinstance(dependency.call, AuthRule):
                rule = dependency.call
            for child in dependency.dependencies:
                yield from visit(child, rule)

        for dependency in dependant.dependencies:
            yield from visit(dependency)

    @classmethod
    def get_auth_mode(
        cls, request: Request, auth_dependencies: tuple[Callable, ...]
    ) -> Literal['pre_auth', 'current_user', 'excluded']:
        """
        根据路由的依赖声明确定登录认证方式

        :param request: 当前请求对象
        :param auth_dependencies: 需要识别的认证入口和令牌依赖
        :return: 前置认证、显式认证或排除认证
        """
        route = request.scope.get('route')
        # FastAPI在include_router延迟注册时写入实际上下文，包含父路由和插件追加的依赖。
        context = request.scope.get('fastapi', {}).get('effective_route_context')
        if context is not None and context.original_route is route:
            route = context
        dependant = getattr(route, 'dependant', None)
        if dependant is None:
            return 'current_user'
        provider = getattr(route, 'dependency_overrides_provider', None)
        overrides = getattr(provider, 'dependency_overrides', {})

        # 只读取依赖声明；任一分支要求登录时都不能被其他分支的排除规则放行。
        mode = None
        for rule in cls.iter_auth_dependencies(dependant, auth_dependencies, overrides):
            if rule is None:
                return 'current_user'
            if not rule.is_excluded(request):
                return 'pre_auth'
            mode = 'excluded'
        return mode or 'current_user'
