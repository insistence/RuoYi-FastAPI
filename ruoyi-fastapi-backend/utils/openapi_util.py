import re
from collections.abc import Iterator, Sequence
from typing import Any
from uuid import UUID

from fastapi.routing import APIRoute, iter_route_contexts
from fastapi.security.base import SecurityBase
from starlette.convertors import Convertor, FloatConvertor, IntegerConvertor, StringConvertor, UUIDConvertor
from starlette.routing import BaseRoute

from common.auth_policy import AuthPolicy, AuthRule
from module_admin.service.login_service import LoginService, oauth2_scheme


class OpenAPIUtil:
    """
    OpenAPI认证声明工具类
    """

    _MAX_PATH_STATES = 4096
    _CONDITIONAL_DESCRIPTION = (
        '免登录访问需在 x-login-auth 的每组规则中至少匹配一条排除规则，'
        '且不属于该条规则的例外路径；其他安全要求仍需满足。'
    )
    _UNRESOLVED_DESCRIPTION = '路径条件无法完整静态展开，安全声明保留登录要求；实际免登录范围以所列规则为准。'

    @classmethod
    def adjust_security(cls, schema: dict[str, Any], routes: Sequence[BaseRoute]) -> dict[str, Any]:
        """
        根据前置认证规则调整各接口的登录安全声明

        :param schema: 可修改的OpenAPI文档副本
        :param routes: 应用路由列表
        :return: 调整后的OpenAPI文档
        """
        for route, method in cls._iter_auth_routes(routes):
            requirements = list(
                AuthPolicy.iter_auth_dependencies(route.dependant, (LoginService.get_current_user, oauth2_scheme))
            )
            if not requirements or any(item is None for item in requirements):
                continue
            # 同名的其他安全依赖仍可能要求凭证，不能随宿主登录声明一起移除。
            if cls._has_external_login_scheme(route.dependant):
                continue
            operation = schema.get('paths', {}).get(route.path_format, {}).get(method.lower())
            if operation is None:
                continue
            mode = cls._get_auth_mode(route, method, requirements)
            if mode == 'required':
                continue
            if mode != 'unknown':
                cls._adjust_operation_security(operation, conditional=mode == 'conditional')
            if mode in ('conditional', 'unknown'):
                operation['x-login-auth'] = {
                    'mode': 'conditional',
                    'exclude_groups': [
                        [
                            {
                                'path': rule['original_path'],
                                'pattern': rule['pattern'].pattern,
                                'methods': list(rule['methods']),
                                'ignore_paths': list(rule['ignore_paths']),
                            }
                            for rule in pre_auth.exclude_patterns
                        ]
                        for pre_auth in requirements
                    ],
                }
                description = operation.get('description', '')
                if cls._CONDITIONAL_DESCRIPTION not in description:
                    description = '\n\n'.join(item for item in (description, cls._CONDITIONAL_DESCRIPTION) if item)
                if mode == 'unknown':
                    operation['x-login-auth']['static_analysis'] = 'unresolved'
                    if cls._UNRESOLVED_DESCRIPTION not in description:
                        description = f'{description}\n\n{cls._UNRESOLVED_DESCRIPTION}'
                operation['description'] = description
        return schema

    @staticmethod
    def _iter_auth_routes(routes: Sequence[BaseRoute]) -> Iterator[tuple[Any, str]]:
        """
        获取不存在重复声明的路由

        :param routes: 应用路由列表
        :return: 唯一路由及HTTP方法
        """
        first_routes = {}
        conflicting_operations = set()
        for route in iter_route_contexts(routes):
            if not isinstance(route.original_route, APIRoute):
                continue
            for method in route.methods or []:
                key = (route.path_format, method)
                if key in first_routes:
                    conflicting_operations.add(key)
                else:
                    first_routes[key] = route

        for key, route in first_routes.items():
            # 重复声明和隐藏路由可能使实际匹配与文档来源不同，保留原生声明。
            if key not in conflicting_operations:
                yield route, key[1]

    @classmethod
    def _has_external_login_scheme(cls, dependency: Any) -> bool:
        """
        判断是否存在与宿主登录同名的其他安全依赖

        :param dependency: 路由依赖声明
        :return: 是否需要保留同名安全声明
        """
        call = dependency.call
        if (
            isinstance(call, SecurityBase)
            and call is not oauth2_scheme
            and call.scheme_name == oauth2_scheme.scheme_name
        ):
            return True
        return any(cls._has_external_login_scheme(child) for child in dependency.dependencies)

    @classmethod
    def _adjust_operation_security(cls, operation: dict[str, Any], *, conditional: bool) -> None:
        """
        调整宿主登录要求并保留其他安全方案

        :param operation: 接口文档
        :param conditional: 是否仅部分路径需要登录
        :return: None
        """
        security = operation.get('security', [])
        scheme = oauth2_scheme.scheme_name
        login_scopes = None
        remaining = []
        anonymous = any(not requirement for requirement in security)
        for requirement in security:
            if scheme in requirement:
                login_scopes = requirement[scheme]
            other = {key: value for key, value in requirement.items() if key != scheme}
            if other and other not in remaining:
                remaining.append(other)
        if login_scopes is None:
            return
        # 文档原有的匿名选项可能来自可选的其他认证方案，应与新移除的登录要求区别处理。
        if anonymous:
            remaining.append({})
        if not conditional:
            operation['security'] = remaining
            return
        # 免登录的选项仍需满足其他安全要求，不能用空对象放行API Key等独立校验。
        alternatives = remaining or [{}]
        operation['security'] = [{scheme: login_scopes, **requirement} for requirement in alternatives] + alternatives

    @classmethod
    def _get_auth_mode(cls, route: Any, method: str, requirements: list[AuthRule]) -> str:
        """
        判断接口是否始终、从不或按路径参数要求登录

        :param route: 包含最终路径和依赖的路由
        :param method: HTTP方法
        :param requirements: 各前置认证分支
        :return: required、public、conditional或无法完整分析的unknown
        """
        if not route.param_convertors:
            return 'public' if all(item.is_excluded_path(route.path, method) for item in requirements) else 'required'
        ignored_paths = {
            path for item in requirements for rule in cls._method_rules(item, method) for path in rule['ignore_paths']
        }
        if all(cls._has_template_coverage(route, method, item) for item in requirements):
            # 相同模板覆盖全部参数取值，例外路径需逐一检查。
            return (
                'public'
                if all(
                    not route.path_regex.fullmatch(path) or item.is_excluded_path(path, method)
                    for item in requirements
                    for path in ignored_paths
                )
                else 'conditional'
            )
        shape = cls._get_path_shape(route)
        if shape is None:
            # OpenAPI不能直接表达复杂路径正则的认证条件，保留完整规则供调用方判断。
            return 'required' if any(not cls._method_rules(item, method) for item in requirements) else 'unknown'
        segments, convertors = shape
        groups = [cls._get_rule_constraints(item, method, segments, convertors) for item in requirements]
        if any(not rules and not unknown for rules, unknown in groups):
            return 'required'
        # 某条规则覆盖所有参数值时，只需检查其有限的例外路径是否被其他规则重新排除。
        if all(
            segments in rules
            and all(
                not route.path_regex.fullmatch(path) or pre_auth.is_excluded_path(path, method)
                for path in ignored_paths
            )
            for pre_auth, (rules, _) in zip(requirements, groups, strict=True)
        ):
            return 'public'
        anonymous = cls._has_public_path(segments, convertors, groups, ignored_paths, requirements, method)
        if anonymous is None:
            return 'unknown'
        return 'conditional' if anonymous else 'required'

    @classmethod
    def _has_template_coverage(cls, route: Any, method: str, pre_auth: AuthRule) -> bool:
        """
        判断同一模板的排除规则是否覆盖全部参数值

        :param route: 接口路由
        :param method: HTTP方法
        :param pre_auth: 前置认证依赖
        :return: 不考虑有限例外时是否覆盖所有参数值
        """
        supported = {StringConvertor.regex, IntegerConvertor.regex, FloatConvertor.regex, UUIDConvertor.regex}
        if any(convertor.regex not in supported for convertor in route.param_convertors.values()):
            return False
        parameters = re.findall(r'\{[^}]+\}', route.path)
        if len(parameters) != len(route.param_convertors):
            return False
        skeleton = re.sub(r'\{[^}]+\}', '{}', route.path)
        # 非空单段参数可由[^/]+覆盖；相同位置的点号也能匹配固定的点号，不改变模板结构。
        if re.search(r'[\^$*+?{}\[\]\\|()]', skeleton.replace('{}', '')):
            return False
        rules = cls._method_rules(pre_auth, method)
        return any(re.sub(r'\{[^}]+\}', '{}', rule['original_path']) == skeleton for rule in rules)

    @staticmethod
    def _method_rules(pre_auth: AuthRule, method: str) -> list[dict[str, Any]]:
        """
        获取适用于当前HTTP方法的排除规则

        :param pre_auth: 前置认证依赖
        :param method: HTTP方法
        :return: 排除规则列表
        """
        return [rule for rule in pre_auth.exclude_patterns if not rule['methods'] or method in rule['methods']]

    @staticmethod
    def _get_path_shape(route: Any) -> tuple[tuple[str | None, ...], dict[int, Convertor]] | None:
        """
        将普通路径模板拆分为固定段和单段参数

        :param route: 接口路由
        :return: 路径段及参数转换器，复杂模板返回None
        """
        segments = []
        convertors = {}
        supported = {StringConvertor.regex, IntegerConvertor.regex, FloatConvertor.regex, UUIDConvertor.regex}
        for index, segment in enumerate(route.path.split('/')):
            parameter = re.fullmatch(r'\{([^{}:]+)(?::[^{}]+)?\}', segment)
            if parameter:
                convertor = route.param_convertors[parameter[1]]
                if convertor.regex not in supported:
                    return None
                convertors[index] = convertor
                segments.append(None)
            elif '{' in segment or '}' in segment:
                return None
            else:
                segments.append(segment)
        return tuple(segments), convertors

    @classmethod
    def _get_rule_constraints(
        cls,
        pre_auth: AuthRule,
        method: str,
        segments: tuple[str | None, ...],
        convertors: dict[int, Convertor],
    ) -> tuple[list[tuple[str | None, ...]], bool]:
        """
        将排除规则转换为路径参数的取值约束

        :param pre_auth: 前置认证依赖
        :param method: HTTP方法
        :param segments: 路径模板
        :param convertors: 参数转换器
        :return: 普通规则约束和是否包含复杂正则
        """
        constraints = []
        unknown = False
        for rule in cls._method_rules(pre_auth, method):
            parts = rule['original_path'].split('/')
            if any(not re.fullmatch(r'\{[^{}]+\}', part) and re.search(r'[.^$*+?{}\[\]\\|()]', part) for part in parts):
                unknown = True
                continue
            if len(parts) != len(segments):
                continue
            values = list(segments)
            for index, part in enumerate(parts):
                if re.fullmatch(r'\{[^{}]+\}', part):
                    if values[index] == '':
                        break
                elif values[index] is None:
                    if not re.fullmatch(convertors[index].regex, part):
                        break
                    values[index] = part
                elif values[index] != part:
                    break
            else:
                constraint = tuple(values)
                if constraint not in constraints:
                    constraints.append(constraint)
        return constraints, unknown

    @classmethod
    def _has_public_path(
        cls,
        segments: tuple[str | None, ...],
        convertors: dict[int, Convertor],
        groups: list[tuple[list[tuple[str | None, ...]], bool]],
        ignored_paths: set[str],
        requirements: list[AuthRule],
        method: str,
    ) -> bool | None:
        """
        判断各前置认证分支的公开路径是否存在交集

        :param segments: 路径模板
        :param convertors: 参数转换器
        :param groups: 各分支的参数约束
        :param ignored_paths: 规则中的例外路径
        :param requirements: 前置认证分支
        :param method: HTTP方法
        :return: 是否存在公开路径，复杂规则或分析上限返回None
        """
        choices = sorted([rules + ([segments] if unknown else []) for rules, unknown in groups], key=len)
        visited = set()
        limited = False
        unresolved = False
        has_unknown_rules = any(unknown for _, unknown in groups)

        def visit(index: int, values: tuple[str | None, ...]) -> bool:
            nonlocal limited, unresolved
            state = (index, values)
            if state in visited:
                return False
            if len(visited) >= cls._MAX_PATH_STATES:
                limited = True
                return False
            visited.add(state)
            if index == len(choices):
                path = cls._get_candidate_path(values, convertors, ignored_paths)
                if all(item.is_excluded_path(path, method) for item in requirements):
                    return True
                # 参数已全部固定时，实际匹配结果足以证明该分支没有公开路径。
                if has_unknown_rules and any(value is None for value in values):
                    unresolved = True
                return False
            for constraint in choices[index]:
                combined = []
                for current, required in zip(values, constraint, strict=True):
                    if current is not None and required is not None and current != required:
                        break
                    combined.append(current if current is not None else required)
                else:
                    if visit(index + 1, tuple(combined)):
                        return True
            return False

        if visit(0, segments):
            return True
        return None if limited or unresolved else False

    @staticmethod
    def _get_candidate_path(
        segments: tuple[str | None, ...], convertors: dict[int, Convertor], ignored_paths: set[str]
    ) -> str:
        """
        为未固定的参数选择不落入有限例外列表的值

        :param segments: 已合并的路径参数约束
        :param convertors: 参数转换器
        :param ignored_paths: 例外路径
        :return: 用于检查规则交集的实际路径
        """
        values = list(segments)
        ignored_segments = [path.split('/') for path in ignored_paths]
        for index, convertor in convertors.items():
            if values[index] is not None:
                continue
            excluded = {parts[index] for parts in ignored_segments if len(parts) == len(values)}
            for number in range(len(excluded) + 1):
                if convertor.regex == StringConvertor.regex:
                    candidate = f'__openapi_{number}__'
                elif convertor.regex == UUIDConvertor.regex:
                    candidate = str(UUID(int=number))
                else:
                    candidate = str(number)
                if candidate not in excluded:
                    values[index] = candidate
                    break
        return '/'.join(values)
