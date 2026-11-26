import ast
import builtins
import re
import subprocess
import sys
import tokenize
from collections.abc import Generator, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from functools import cache
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from docutils import frontend, nodes, utils
from docutils.parsers.rst import Parser
from sphinx.application import Sphinx
from sphinx.domains.python import PyObject
from sphinx.errors import SphinxWarning
from sphinx.util.docstrings import prepare_docstring
from sphinx.util.docutils import docutils_namespace, sphinx_domains

# key 是 Python 域文档列出的参数别名，meta 由 autodoc 消费。
FIELD_KINDS = {'key': 'parameter', 'meta': 'meta', 'yield': 'yieldvalue', 'yields': 'yieldvalue'}
CHINESE = re.compile(r'[\u3400-\u9fff\U00020000-\U0002fa1f]')
KEYWORD_FIELDS = {'key', 'keyword', 'kwarg', 'kwparam'}
MAX_TYPED_FIELD_WORDS = 2
for field_type in PyObject.doc_field_types:
    FIELD_KINDS.update(dict.fromkeys(field_type.names, field_type.name))
    FIELD_KINDS.update(dict.fromkeys(getattr(field_type, 'typenames', ()), f'{field_type.name}type'))
ROLE = re.compile(r'^:(?:[\w-]+:)+`')
SECTION = re.compile(
    r'(?:Args?|Arguments?|Parameters?|Other Parameters|Keyword (?:Args|Arguments|Parameters)|'
    r'Returns?|Yields?|Raises?|Warns?|Warnings?|Attributes?|Methods?|Receives|'
    r'参数|返回值?|异常)([:：]?)',
    re.IGNORECASE,
)
FOREIGN_MARKUP = re.compile(
    r'^(?:@(?:param|type|returns?|rtype|raises?|throws|yields?|brief)\b|#{1,6}\s|`{3}|~{3,}\w|'
    r'(?:Examples?|Notes?|See Also|References):$|(?:param|raises)\s+\w+:|：\w+)',
    re.IGNORECASE,
)
MARKDOWN_LINK = re.compile(r'\[[^]\n]+\]\([^\s)]+\)')
UNPARSED_LITERAL = re.compile(r'(?<![\\`])``(?!`)')
DEFINITIONS = (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
MODEL_BASES = {
    'pydantic.BaseModel',
    'pydantic.main.BaseModel',
    'pydantic.RootModel',
    'pydantic.v1.BaseModel',
    'pydantic_settings.BaseSettings',
    'pydantic_settings.main.BaseSettings',
    'sqlalchemy.orm.DeclarativeBase',
    'sqlalchemy.orm.DeclarativeBaseNoMeta',
}
MODEL_FACTORIES = {
    'sqlalchemy.orm.declarative_base',
    'sqlalchemy.ext.declarative.declarative_base',
    'config.database.get_data_source_base',
    'pydantic.create_model',
}
Bindings = dict[str, str | ast.expr]
COLUMN_CALLS = {
    'sqlalchemy.Column',
    'sqlalchemy.schema.Column',
    'sqlalchemy.sql.schema.Column',
    'sqlalchemy.orm.mapped_column',
}
TABLE_CALLS = {'sqlalchemy.Table', 'sqlalchemy.schema.Table', 'sqlalchemy.sql.schema.Table'}
FIELD_CALLS = {'pydantic.Field', 'pydantic.fields.Field', 'pydantic.v1.Field'}
ANNOTATED = {'typing.Annotated', 'typing_extensions.Annotated'}
CLASS_VAR = {'typing.ClassVar', 'typing_extensions.ClassVar'}
COMPUTED_FIELD = {'pydantic.computed_field', 'pydantic.fields.computed_field'}
BACKEND = Path(__file__).resolve().parents[1]
ALEMBIC_ENV = BACKEND / 'alembic' / 'env.py'
ROUTER_MODULE = BACKEND / 'common' / 'router.py'
HTTP_OPERATIONS = {
    'api_route',
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace',
}
ROUTE_METHODS = HTTP_OPERATIONS | {'route', 'websocket', 'websocket_route'}
ROUTE_REGISTRATIONS = {'add_api_route', 'add_route', 'add_websocket_route', 'add_api_websocket_route'}


def scoped_statements(suite: list[ast.stmt]) -> Iterator[ast.stmt]:
    """
    遍历当前作用域的语句，在新函数和类的边界停止。

    :param suite: 当前词法作用域中的语句列表
    :yield: 当前词法作用域中的语句
    """
    for statement in suite:
        yield statement
        if not isinstance(statement, DEFINITIONS):
            for child in ast.iter_child_nodes(statement):
                if isinstance(child, ast.stmt):
                    yield from scoped_statements([child])
                elif isinstance(child, (ast.ExceptHandler, ast.match_case)):
                    yield from scoped_statements(child.body)


def statement_calls(item: ast.stmt) -> Iterator[ast.Call]:
    """
    遍历语句表达式中的调用，包括推导式，子语句由其作用域单独处理。

    :param item: 当前作用域的语句
    :yield: 语句自身包含的调用表达式
    """
    for expr in ast.iter_child_nodes(item):
        if isinstance(expr, ast.expr):
            yield from (call for call in ast.walk(expr) if isinstance(call, ast.Call))


def model_symbols(
    tree: ast.Module, module: str, package: str, tables: dict[ast.Call, Bindings] | None = None
) -> tuple[dict[str, tuple[str, ...]], dict[ast.ClassDef, tuple[str, Bindings]]]:
    """
    从源码收集导入别名、基类和声明式模型工厂，无需导入业务模块。

    :param tree: 待校验源码的抽象语法树
    :param module: 当前源码模块的完整名称
    :param package: 用于解析相对导入的包名
    :param tables: 接收当前文件显式 Table 声明及其名称绑定的索引
    :return: 依次为 ``symbols``、``classes`` 的元组
    """
    symbols = {}
    classes = {}

    def visit(suite: list[ast.stmt], prefix: str, names: dict[str, str], bindings: Bindings) -> None:
        """
        解析当前作用域的绑定，并记录每个类的完整名称。

        :param suite: 当前词法作用域中的语句列表
        :param prefix: 当前作用域的完整名称前缀
        :param names: 当前作用域中可用的名称绑定
        :param bindings: 字段声明能引用的导入和赋值
        """

        def reference(expr: ast.expr) -> str:
            """
            将基类表达式展开为带模块名的引用。

            :param expr: 需要解析的基类或别名表达式
            :return: 含模块前缀的基类名称，无法解析时为空字符串
            """
            if isinstance(expr, ast.Subscript):
                return reference(expr.value)
            if isinstance(expr, ast.Name):
                return names.get(expr.id, expr.id)
            if isinstance(expr, ast.Attribute):
                return f'{reference(expr.value)}.{expr.attr}'
            return ''

        for item in scoped_statements(suite):
            if tables is not None:
                tables.update(
                    (call, bindings.copy())
                    for call in statement_calls(item)
                    if imported_name(call.func, bindings) in TABLE_CALLS
                )
            if isinstance(item, ast.Import):
                for alias in item.names:
                    head = alias.name.split('.')[0]
                    names[alias.asname or head] = alias.name if alias.asname else head
                    bindings[alias.asname or head] = names[alias.asname or head]
            elif isinstance(item, ast.ImportFrom):
                parts = package.split('.') if item.level else []
                if item.level > 1:
                    parts = parts[: 1 - item.level]
                origin = '.'.join(filter(None, [*parts, item.module]))
                for alias in item.names:
                    name = alias.asname or alias.name
                    names[name] = f'{origin}.{alias.name}'.strip('.')
                    bindings[name] = names[name]
                    symbols[f'{prefix}.{name}'] = (names[name],)
            elif isinstance(item, ast.Assign) and len(item.targets) == 1 and isinstance(item.targets[0], ast.Name):
                name = item.targets[0].id
                base = reference(item.value.func) + '()' if isinstance(item.value, ast.Call) else reference(item.value)
                names[name] = f'{prefix}.{name}'
                symbols[names[name]] = (base,)
                bindings[name] = item.value
            elif isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name) and item.value is not None:
                bindings[item.target.id] = item.value
            elif isinstance(item, DEFINITIONS):
                qualified = f'{prefix}.{item.name}'
                if isinstance(item, ast.ClassDef):
                    decorators = (d.func if isinstance(d, ast.Call) else d for d in item.decorator_list)
                    mapped = (
                        d
                        for d in decorators
                        if isinstance(d, ast.Attribute) and d.attr in {'mapped', 'mapped_as_dataclass'}
                    )
                    symbols[qualified] = tuple(reference(base) for base in (*item.bases, *mapped))
                    classes[item] = (qualified, bindings.copy())
                names[item.name] = qualified
                visit(item.body, qualified, names.copy(), bindings.copy())

    visit(tree.body, module, {}, {})
    return symbols, classes


def model_classes(
    tree: ast.Module, path: Path, tables: dict[ast.Call, Bindings]
) -> dict[ast.ClassDef, tuple[str | None, Bindings]]:
    """
    沿本地源码的继承关系识别模型，支持单文件检查及跨模块派生。

    :param tree: 待校验源码的抽象语法树
    :param path: 要读取或处理的路径
    :param tables: 接收显式声明的数据库表
    :return: 每个类对应的模型种类和字段可见的名称绑定
    """
    path = path.resolve()
    root = next((folder for folder in path.parents if (folder / 'ruff.toml').is_file()), path.parent)
    while (root / '__init__.py').is_file():
        root = root.parent
    roots = (root, path.parent, BACKEND)
    module = '.'.join(path.relative_to(root).with_suffix('').parts).removesuffix('.__init__')
    package = module if path.stem == '__init__' else module.rpartition('.')[0]
    symbols, classes = model_symbols(tree, module, package, tables)

    @cache
    def load_module(name: str) -> dict[str, tuple[str, ...]]:
        """
        读取导入目标的基类索引，包括包对基类的重新导出。

        :param name: 要读取的本地模块的完整名称
        :return: 导入目标的基类索引
        """
        relative = Path(*name.split('.'))
        for folder in roots:
            for target in (folder / relative.with_suffix('.py'), folder / relative / '__init__.py'):
                if target.is_file():
                    with tokenize.open(target) as stream:
                        imported = ast.parse(stream.read(), filename=str(target))
                    parent = name if target.stem == '__init__' else name.rpartition('.')[0]
                    return model_symbols(imported, name, parent)[0]
        return {}

    def model_kind(name: str, seen: set[str], registry: bool = False) -> str | None:
        """
        判断引用是否最终指向已知模型基类或工厂，遇到循环引用时停止。

        :param name: 待解析的基类或注册表引用
        :param seen: 当前解析链中已访问的名称
        :param registry: 是否只匹配 SQLAlchemy 映射注册表
        :return: 识别到的模型种类，普通类返回空值
        """
        if name in seen or not name:
            return None
        if registry and name == 'sqlalchemy.orm.registry()':
            return 'sqlalchemy'
        if not registry:
            if name in MODEL_BASES or (name.endswith('()') and name[:-2] in MODEL_FACTORIES):
                return 'pydantic' if name.startswith('pydantic') else 'sqlalchemy'
            owner, _, method = name.rpartition('.')
            if method in {'generate_base()', 'mapped', 'mapped_as_dataclass'}:
                return model_kind(owner, seen | {name}, registry=True)
        bases = symbols.get(name)
        if bases is None:
            origin, _, _ = name.rpartition('.')
            bases = load_module(origin).get(name, ()) if all(part.isidentifier() for part in origin.split('.')) else ()
        return next((kind for base in bases if (kind := model_kind(base, seen | {name}, registry))), None)

    return {node: (model_kind(name, set()), bindings) for node, (name, bindings) in classes.items()}


def resolve_binding(expr: ast.expr | None, bindings: Bindings) -> ast.expr | str | None:
    """
    展开当前作用域中的别名与常量，保留无法静态求值的表达式。

    :param expr: 字段声明中的表达式
    :param bindings: 当前可用的名称绑定
    :return: 导入的完整名称、绑定的表达式或空值
    """
    seen = set()
    resolved: ast.expr | str | None = expr
    while isinstance(resolved, ast.Name) and resolved.id in bindings and resolved.id not in seen:
        seen.add(resolved.id)
        resolved = bindings[resolved.id]
    return resolved


def imported_name(expr: ast.expr | None, bindings: Bindings) -> str:
    """
    解析调用、装饰器或类型标注引用的导入名称。

    :param expr: 要解析的名称或属性访问
    :param bindings: 当前可用的名称绑定
    :return: 导入的完整名称，无法解析时返回空字符串
    """
    parts = []
    seen = set()
    resolved = resolve_binding(expr, bindings)
    while isinstance(resolved, ast.Attribute) and resolved not in seen:
        seen.add(resolved)
        parts.append(resolved.attr)
        resolved = resolve_binding(resolved.value, bindings)
    return '.'.join([resolved, *reversed(parts)]) if isinstance(resolved, str) else ''


def field_annotation(annotation: ast.expr | None, bindings: Bindings) -> tuple[set[str], list[ast.expr]]:
    """
    提取直接作用于字段的类型包装和 Annotated 元数据。

    :param annotation: 字段的类型标注
    :param bindings: 当前可用的名称绑定
    :return: 字段的外层类型和按覆盖顺序排列的元数据
    """
    wrappers = set()
    metadata = []
    seen = set()
    while annotation is not None:
        value = resolve_binding(annotation, bindings)
        if value in seen:
            break
        seen.add(value)
        if isinstance(value, ast.Constant) and isinstance(value.value, str):
            try:
                annotation = ast.parse(value.value, mode='eval').body
            except SyntaxError:
                break
            continue
        if not isinstance(value, ast.Subscript):
            wrappers.add(imported_name(annotation, bindings))
            break
        kind = imported_name(value.value, bindings)
        wrappers.add(kind)
        if kind in ANNOTATED and isinstance(value.slice, ast.Tuple):
            annotation, *items = value.slice.elts
            metadata[:0] = items
        elif kind == 'sqlalchemy.orm.Mapped':
            annotation = value.slice
        else:
            break
    return wrappers, metadata


def missing_chinese_text(expr: ast.expr | None, bindings: Bindings) -> bool:
    """
    判断说明是否缺失，或其可静态解析的值不是含中文的文本。

    :param expr: 提供说明的表达式
    :param bindings: 当前作用域的名称绑定
    :return: 是否应报告说明无效
    """
    value = resolve_binding(expr, bindings)
    if isinstance(value, ast.Constant):
        return not isinstance(value.value, str) or CHINESE.search(value.value) is None
    return value is None or isinstance(value, (ast.List, ast.Tuple, ast.Set, ast.Dict))


def metadata_problem(calls: list[ast.expr], keyword: str, bindings: Bindings) -> bool:
    """
    检查字段的有效说明，允许引用共享说明和运行时计算的文本。

    :param calls: 按字段元数据覆盖顺序排列的声明
    :param keyword: 指定说明的关键字名称
    :param bindings: 当前可用的名称绑定
    :return: 是否缺少说明或已知说明未包含中文
    """
    values = [
        kw.value
        for expr in calls
        if isinstance(call := resolve_binding(expr, bindings), ast.Call)
        for kw in call.keywords
        if kw.arg == keyword
    ]
    return missing_chinese_text(values[-1] if values else None, bindings)


def model_field_errors(owner: ast.ClassDef, kind: str | None, bindings: Bindings) -> Iterator[tuple[int, str]]:
    """
    校验 Pydantic 模型字段、计算字段和 SQLAlchemy 映射列的说明。

    :param owner: 包含字段声明的类
    :param kind: 从继承关系解析出的模型种类
    :param bindings: 类定义可见的导入和赋值
    :yield: 字段声明行号及缺失的元数据
    """

    def call_name(expr: ast.expr | None) -> str:
        """
        解析字段构造器的导入名称。

        :param expr: 可能通过别名引用的调用表达式
        :return: 构造器的完整名称
        """
        value = resolve_binding(expr, bindings)
        return imported_name(value.func, bindings) if isinstance(value, ast.Call) else ''

    def check(name: str, line: int, keyword: str, declarations: list[ast.expr]) -> Iterator[tuple[int, str]]:
        """
        将无效的字段说明转换为包含类名的诊断。

        :param name: 字段名称
        :param line: 声明所在行号
        :param keyword: 字段说明的关键字
        :param declarations: 提供元数据的字段声明
        :yield: 行号和诊断文本
        """
        if metadata_problem(declarations, keyword, bindings):
            yield line, f'{owner.name}.{name} 必须填写含中文的 {keyword}'

    def method_fields(method: ast.FunctionDef | ast.AsyncFunctionDef) -> Iterator[tuple[int, str]]:
        """
        检查装饰器声明的计算字段和由方法创建的映射列。

        :param method: 可能用于构造模型字段的方法
        :yield: 计算字段或映射列的诊断
        """
        for decorator in method.decorator_list:
            name = imported_name(decorator.func if isinstance(decorator, ast.Call) else decorator, bindings)
            if kind == 'pydantic' and name in COMPUTED_FIELD:
                yield from check(method.name, method.lineno, 'description', [decorator])
            if name == 'sqlalchemy.orm.declared_attr':
                for stmt in scoped_statements(method.body):
                    if (
                        isinstance(stmt, ast.Return)
                        and stmt.value is not None
                        and call_name(stmt.value) in COLUMN_CALLS
                    ):
                        yield from check(method.name, stmt.lineno, 'comment', [stmt.value])

    for item in scoped_statements(owner.body):
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            yield from method_fields(item)
        if not isinstance(item, (ast.Assign, ast.AnnAssign)):
            continue
        targets = item.targets if isinstance(item, ast.Assign) else [item.target]
        annotation = item.annotation if isinstance(item, ast.AnnAssign) else None
        wrappers, metadata = field_annotation(annotation, bindings)
        candidates = [*metadata, item.value] if item.value is not None else metadata
        for target in targets:
            if not isinstance(target, ast.Name):
                continue
            name = target.id
            if (
                kind == 'pydantic'
                and annotation
                and not (name.startswith('_') or name == 'model_config' or wrappers & CLASS_VAR)
            ):
                fields = [expr for expr in candidates if call_name(expr) in FIELD_CALLS]
                yield from check(name, item.lineno, 'description', fields)
            else:
                columns = [expr for expr in candidates if call_name(expr) in COLUMN_CALLS]
                if columns or (item.value is None and 'sqlalchemy.orm.Mapped' in wrappers):
                    yield from check(name, item.lineno, 'comment', columns)
            if item.value is not None:
                bindings[name] = item.value


def table_field_errors(tables: dict[ast.Call, Bindings]) -> Iterator[tuple[int, str]]:
    """
    检查通过 SQLAlchemy Table 显式传入的列，覆盖插件独立定义的表。

    :param tables: 按源码顺序收集的表声明及其名称绑定
    :yield: 缺少列说明的位置与诊断
    """
    for table, bindings in tables.items():
        for expr in table.args:
            column = resolve_binding(expr, bindings)
            if (
                isinstance(column, ast.Call)
                and imported_name(column.func, bindings) in COLUMN_CALLS
                and metadata_problem([column], 'comment', bindings)
            ):
                table_name = ast.unparse(table.args[0]).strip('"\'')
                name = ast.unparse(column.args[0]).strip('"\'') if column.args else '列'
                yield column.lineno, f'{table_name}.{name} 必须填写含中文的 comment'


def assigned_names(target: ast.expr, receiver: str | None) -> Iterator[str]:
    """
    提取单一或解包赋值中属于当前类或绑定方法接收者的属性。

    :param target: 赋值语句左侧的表达式
    :param receiver: 方法的隐式接收者名称，类体赋值时为空
    :yield: 归属于该类或接收者的属性名称
    """
    if isinstance(target, (ast.Tuple, ast.List)):
        for element in target.elts:
            yield from assigned_names(element, receiver)
    elif isinstance(target, ast.Starred):
        yield from assigned_names(target.value, receiver)
    elif receiver is None and isinstance(target, ast.Name):
        yield target.id
    elif isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == receiver:
        yield target.attr


def class_attributes(owner: ast.ClassDef) -> set[str]:
    """
    收集类体的属性声明，以及绑定方法直接写入的实例或类属性。

    :param owner: 要收集属性的类定义
    :return: 类体的属性声明
    """

    def assignments(suite: list[ast.stmt], receiver: str | None) -> Iterator[str]:
        """
        从当前作用域的赋值语句中读取属性名。

        :param suite: 当前词法作用域中的语句列表
        :param receiver: 方法的隐式接收者名称，类体赋值时为空
        :yield: 委托迭代器逐项提供的元素
        """
        for item in scoped_statements(suite):
            if isinstance(item, (ast.AnnAssign, ast.Assign)):
                targets = item.targets if isinstance(item, ast.Assign) else [item.target]
                for target in targets:
                    if receiver is None and isinstance(target, ast.Name) and target.id == '__slots__':
                        value = item.value
                        slots = value.elts if isinstance(value, (ast.Tuple, ast.List)) else [value]
                        if isinstance(value, ast.Dict):
                            slots = value.keys
                        yield from (s.value for s in slots if isinstance(s, ast.Constant) and isinstance(s.value, str))
                    else:
                        yield from assigned_names(target, receiver)

    names = set(assignments(owner.body, None))
    for method in scoped_statements(owner.body):
        if isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)) and (receiver := bound_receiver(method)):
            names.update(assignments(method.body, receiver))
    return names


def bound_receiver(method: ast.FunctionDef | ast.AsyncFunctionDef) -> str | None:
    """
    返回绑定方法的首个位置参数，静态方法没有隐式参数。

    :param method: 待分析的方法定义
    :return: 绑定方法的首个位置参数
    """
    positional = method.args.posonlyargs or method.args.args
    if not positional or any(
        ast.unparse(d) in {'staticmethod', 'builtins.staticmethod'} for d in method.decorator_list
    ):
        return None
    return positional[0].arg


def route_doc_errors(call: ast.Call, bindings: Bindings) -> Iterator[tuple[int, str]]:
    """
    检查单次 HTTP 路径操作注册的摘要和说明，支持共享的元数据字典。

    :param call: 路由装饰器或注册调用
    :param bindings: 注册时可见的局部赋值
    :yield: 缺失或无效的路由文档字段及其行号
    """
    fields = {}
    for kw in call.keywords:
        if kw.arg is not None:
            fields[kw.arg] = kw.value
        elif isinstance(mapping := resolve_binding(kw.value, bindings), ast.Dict):
            fields.update(
                (key.value, value)
                for key, value in zip(mapping.keys, mapping.values, strict=True)
                if isinstance(key, ast.Constant)
            )
    for field in ('summary', 'description'):
        if missing_chinese_text(fields.get(field), bindings):
            yield call.lineno, f'HTTP 路由必须填写含中文的 {field}'


def registered_callback(call: ast.Call) -> ast.expr | None:
    """
    取出显式注册的端点，包括 SDK 权限包装器内的插件回调。

    :param call: 注册路由端点的调用表达式
    :return: 注册调用中的原始端点表达式
    """
    callback = next((kw.value for kw in call.keywords if kw.arg == 'endpoint'), None)
    if callback is None and len(call.args) > 1:
        callback = call.args[1]
    if (
        isinstance(callback, ast.Call)
        and ast.unparse(callback.func).split('.')[-1] == 'plugin_endpoint'
        and callback.args
    ):
        return callback.args[0]
    return callback


def router_method(call: ast.Call, routers: set[str]) -> str | None:
    """
    识别路由对象或应用自带路由器上的方法名。

    :param call: 待识别的装饰器或注册调用
    :param routers: 当前作用域的路由对象名称
    :return: 路由方法名，未匹配时返回空值
    """
    if not isinstance(call.func, ast.Attribute):
        return None
    receiver = call.func.value
    if ast.unparse(receiver) in routers:
        return call.func.attr
    if isinstance(receiver, ast.Attribute) and receiver.attr in {'router', 'webhooks'}:
        receiver = receiver.value
    if ast.unparse(receiver) in routers or (isinstance(receiver, ast.Attribute) and receiver.attr == 'app'):
        return call.func.attr
    return None


def inspect_routes(tree: ast.Module) -> tuple[set[ast.AST], list[tuple[int, str]]]:
    """
    识别路径操作装饰器和显式注册的端点，按作用域匹配回调。

    :param tree: 待校验源码的抽象语法树
    :return: 免写函数文档的端点集合，以及每次 HTTP 注册的文档诊断
    """
    routes = set()
    errors = []
    router_types = {'FastAPI', 'APIRouter', 'APIRouterPro', 'Starlette', 'Router'}
    router_types.update(
        alias.asname
        for item in ast.walk(tree)
        if isinstance(item, ast.ImportFrom)
        for alias in item.names
        if alias.name in router_types and alias.asname
    )
    factories = router_types | {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef)
        and node.returns
        and ast.unparse(node.returns).strip('"\'').split('.')[-1] in router_types
    }
    api_route_types = {'fastapi.routing.APIRoute'} | {
        alias.asname or alias.name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom) and node.module == 'fastapi.routing'
        for alias in node.names
        if alias.name == 'APIRoute'
    }

    def router_names(statements: list[ast.stmt], owner: ast.AST, inherited: set[str]) -> set[str]:
        """
        收集作用域中的路由对象，包括导入、类型标注和局部别名。

        :param statements: 当前作用域的语句
        :param owner: 定义当前作用域的节点
        :param inherited: 外层作用域可引用的路由对象
        :return: 当前作用域可识别的路由对象名称
        """
        names = inherited.copy()
        if isinstance(owner, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names.update(
                arg.arg
                for arg in (*owner.args.posonlyargs, *owner.args.args, *owner.args.kwonlyargs)
                if arg.annotation and ast.unparse(arg.annotation).strip('"\'').split('.')[-1] in router_types
            )
        for node in statements:
            if isinstance(node, ast.ImportFrom):
                names.update(
                    alias.asname or alias.name
                    for alias in node.names
                    if alias.name.endswith(('router', 'controller', 'app'))
                )
            elif isinstance(node, (ast.Assign, ast.AnnAssign)):
                typed = (
                    isinstance(node, ast.AnnAssign)
                    and ast.unparse(node.annotation).strip('"\'').split('.')[-1] in router_types
                )
                constructed = (
                    isinstance(node.value, ast.Call) and ast.unparse(node.value.func).split('.')[-1] in factories
                )
                if (
                    typed
                    or constructed
                    or (isinstance(node.value, (ast.Name, ast.Attribute)) and ast.unparse(node.value) in names)
                ):
                    targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                    names.update(ast.unparse(target) for target in targets)
        return names

    def visit(
        owner: ast.Module | ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef,
        functions: dict[str, ast.AST],
        routers: set[str],
        bindings: Bindings,
    ) -> None:
        """
        在当前作用域中解析路由对象和注册调用，再检查嵌套定义。

        :param owner: 定义当前作用域的模块、类或函数
        :param functions: 当前作用域可引用的函数定义
        :param routers: 当前作用域可见的路由器名称
        :param bindings: 当前作用域可见的路由元数据
        """
        statements = list(scoped_statements(owner.body))
        functions = functions | {node.name: node for node in statements if isinstance(node, DEFINITIONS)}
        routers = router_names(statements, owner, routers)
        bindings = bindings.copy()

        def check_registration(call: ast.Call) -> None:
            """
            匹配显式注册、显式路径操作对象及直接应用的路由装饰器。

            :param call: 当前语句中的调用
            """
            if isinstance(call.func, ast.Call) and router_method(call.func, routers) in ROUTE_METHODS and call.args:
                operation, callback = call.func, call.args[0]
            elif (
                (isinstance(call.func, ast.Attribute) and call.func.attr == 'add_api_route')
                or ast.unparse(call.func) in api_route_types
                or router_method(call, routers) in ROUTE_REGISTRATIONS
            ):
                operation, callback = call, registered_callback(call)
            else:
                return
            if ast.unparse(operation.func) in api_route_types or (
                isinstance(operation.func, ast.Attribute) and operation.func.attr in HTTP_OPERATIONS | {'add_api_route'}
            ):
                errors.extend(route_doc_errors(operation, bindings))
            if isinstance(callback, ast.Name) and callback.id in functions:
                routes.add(functions[callback.id])

        for node in statements:
            if not isinstance(node, DEFINITIONS):
                for call in statement_calls(node):
                    check_registration(call)
            if isinstance(node, (ast.Assign, ast.AnnAssign)) and node.value is not None:
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                bindings.update((target.id, node.value) for target in targets if isinstance(target, ast.Name))
            elif isinstance(node, DEFINITIONS):
                for decorator in node.decorator_list:
                    if (
                        isinstance(decorator, ast.Call)
                        and (method := router_method(decorator, routers)) in ROUTE_METHODS
                    ):
                        routes.add(node)
                        if method in HTTP_OPERATIONS:
                            errors.extend(route_doc_errors(decorator, bindings))
                visit(node, functions, routers, bindings)

    visit(tree, {}, set(), {})
    return routes, errors


def preserved_router(tree: ast.Module, path: Path) -> ast.ClassDef | None:
    """
    定位需要保留原始 FastAPI 文档的路由器类。

    :param tree: 待校验源码的抽象语法树
    :param path: 要读取或处理的路径
    :return: 指定模块中的路由器类，其他文件或没有该类时返回空值
    """
    if path.resolve() == ROUTER_MODULE:
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == 'APIRouterPro':
                return node
    return None


def test_functions(tree: ast.Module, path: Path) -> set[ast.AST]:
    """
    识别 pytest 从测试模块顶层或测试类中收集的函数。

    :param tree: 待校验源码的抽象语法树
    :param path: 要读取或处理的路径
    :return: 会被 pytest 收集的测试函数定义
    """
    if not (path.name.startswith('test_') or path.stem.endswith('_test')):
        return set()
    fixtures = {'pytest.fixture'}
    for item in ast.walk(tree):
        if isinstance(item, ast.ImportFrom) and item.module == 'pytest':
            fixtures.update(alias.asname or alias.name for alias in item.names if alias.name == 'fixture')
        elif isinstance(item, ast.Import):
            fixtures.update(
                f'{alias.asname}.fixture' for alias in item.names if alias.name == 'pytest' and alias.asname
            )
    suites = [
        tree.body,
        *(cls.body for cls in tree.body if isinstance(cls, ast.ClassDef) and cls.name.startswith('Test')),
    ]
    return {
        node
        for suite in suites
        for node in suite
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name.startswith('test')
        and not any(ast.unparse(d.func if isinstance(d, ast.Call) else d) in fixtures for d in node.decorator_list)
    }


@contextmanager
def sphinx_settings() -> Generator[frontend.Values, None, None]:
    """
    初始化一次 Sphinx 内置域和指令，供同一次扫描的文档共用。

    :yield: 共享 Sphinx 环境的 reST 解析设置
    """
    with TemporaryDirectory() as temporary, docutils_namespace():
        root = Path(temporary)
        app = Sphinx(
            root, None, root / 'out', root / 'trees', 'dummy', status=None, warning=None, exception_on_warning=True
        )
        settings = frontend.get_default_settings(Parser())
        settings.env = app.env
        settings.file_insertion_enabled = settings.raw_enabled = False
        settings.warning_stream = False  # 解析器诊断由 reporter 收集并统一输出源文件行号。
        settings.halt_level = utils.Reporter.SEVERE_LEVEL + 1
        yield settings


@dataclass
class Parameters:
    """
    保存可出现在 API 文档中的参数名称及关键字参数能力。

    :ivar names: 可在 Sphinx 字段中引用的参数名
    :ivar accepts_keywords: 签名是否接受任意关键字参数
    """

    names: set[str]
    accepts_keywords: bool


def parameters_for(owner: ast.AST, methods: set[ast.stmt]) -> Parameters | None:
    """
    取函数或显式构造函数的签名，省略实例和类方法的隐式首参。

    :param owner: 声明参数的函数或类
    :param methods: 类体中声明的方法集合
    :return: ``Parameters`` 实例
    """
    function = (
        next((item for item in owner.body if isinstance(item, ast.FunctionDef) and item.name == '__init__'), None)
        if isinstance(owner, ast.ClassDef)
        else owner
    )
    if not isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return None
    args = function.args
    positional = [*args.posonlyargs, *args.args]
    if function in methods and bound_receiver(function):
        positional = positional[1:]
    names = {arg.arg for arg in (*positional, *args.kwonlyargs)}
    for prefix, arg in (('*', args.vararg), ('**', args.kwarg)):
        if arg:
            names.update((arg.arg, prefix + arg.arg))
    return Parameters(names, args.kwarg is not None)


def field_error(field: nodes.field, parameters: Parameters | None, required: dict[str, str]) -> str:
    """
    按照 Python 域的字段类型校验名称、描述及参数引用。

    :param field: 待验证的 reST 字段节点
    :param parameters: 对应函数的签名信息
    :param required: 尚未找到有效描述的参数或属性
    :return: 字段无效时的诊断，通过时为空字符串
    """
    name, *arguments = field[0].astext().split()
    kind = FIELD_KINDS.get(name)
    if kind is None:
        return f'未知 Sphinx Python 字段 :{name}，请使用 :param、:return:、:raises 等字段'
    if not field[1].astext().strip() and kind != 'meta':
        return f'请填写 :{name} 字段的内容，或移除空字段'
    if kind in {'parameter', 'variable', 'returnvalue', 'yieldvalue', 'exceptions'} and not CHINESE.search(
        field[1].astext()
    ):
        return f':{name} 字段须用中文说明其含义'
    if kind in {'returnvalue', 'returntype', 'yieldvalue'}:
        return f'请使用 :{name}: 描述' if arguments else ''
    if not arguments:
        return f'字段 :{name} 需要名称，例如 :param name: 或 :raises ValueError:'
    if kind in {'parameter', 'variable'}:
        if len(arguments) > MAX_TYPED_FIELD_WORDS:
            return f'请将复杂类型写入单独的 :type 或 :vartype 字段；当前为 :{name} {" ".join(arguments)}:'
    elif len(arguments) != 1:
        return f'字段 :{name} 只接受一个名称'
    identifier = arguments[-1]
    if kind in {'parameter', 'parametertype'} and (error := parameter_error(field, name, identifier, parameters)):
        return error
    if kind in {'variable', 'variabletype'} and not arguments[-1].isidentifier():
        return f'字段 :{name} 需要有效的 Python 属性名'
    identifier = identifier.lstrip('*')
    if required.get(identifier) == kind:
        del required[identifier]
    return ''


def parameter_error(field: nodes.field, name: str, param: str, parameters: Parameters | None) -> str:
    """
    比对函数签名，包括可变参数和通过关键字字典接收的选项。

    :param field: 包含参数描述或类型的字段节点
    :param name: Sphinx 字段名
    :param param: 字段引用的参数名称
    :param parameters: 允许使用的签名参数
    :return: 参数引用无效时的诊断，通过时为空字符串
    """
    identifier = param.removeprefix('**') if param.startswith('**') else param.removeprefix('*')
    if not identifier.isidentifier():
        return f'字段 :{name} 需要有效的 Python 参数名'
    if parameters is None or param in parameters.names:
        return ''
    if parameters.accepts_keywords and identifier == param:
        if name in KEYWORD_FIELDS:
            return ''
        if FIELD_KINDS[name] == 'parametertype' and field.parent is not None:
            for sibling in field.parent.findall(nodes.field):
                words = sibling[0].astext().split()
                if words[0] in KEYWORD_FIELDS and words[-1] == param:
                    return ''
    return f'文档参数 {param} 不在函数签名中'


def header_comments(source: str) -> Iterator[tuple[int, str]]:
    """
    检查首条语句之前的注释，保留解释器指令和有效位置上的编码声明。

    :param source: 待检查文件的源代码
    :yield: 违规位置的源码行号和诊断信息
    """
    for token in tokenize.generate_tokens(StringIO(source).readline):
        if token.type == tokenize.NL:
            continue
        if token.type != tokenize.COMMENT:
            break
        line, column = token.start
        if line == 1 and column == 0 and token.string.startswith('#!'):
            continue
        if line in (1, 2) and re.match(r'^#.*?coding[:=][ \t]*[-\w.]+', token.string, re.ASCII):
            continue
        yield line, '请移除 Python 文件顶部的注释'


def comment_language(source: str, tree: ast.Module, path: Path) -> Iterator[tuple[int, str]]:
    """
    检查普通注释使用中文，保留解释器声明和工具指令。

    :param source: 文件原文
    :param tree: 源码的抽象语法树
    :param path: 用于识别保留原文范围的源码路径
    :yield: 全英文注释的行号及说明
    """
    if path.resolve() == ALEMBIC_ENV:
        return
    router = preserved_router(tree, path)
    preserved = range(router.lineno, (router.end_lineno or router.lineno) + 1) if router else ()
    for token in tokenize.generate_tokens(StringIO(source).readline):
        line = token.start[0]
        if token.type != tokenize.COMMENT or line in preserved:
            continue
        content = token.string[1:].strip()
        if line in (1, 2) and (content.startswith('!') or re.search(r'coding[:=]\s*[-\w.]+', content)):
            continue
        if re.fullmatch(
            r'(?:noqa(?:\s*:\s*[A-Z]+\d+(?:[ ,]+[A-Z]+\d+)*)?|type:\s*ignore(?:\[[\w, -]+\])?|'
            r'fmt:\s*(?:off|on|skip)|pragma:\s*no (?:cover|branch))',
            content,
        ):
            continue
        if re.search('[a-zA-Z]', content) and not CHINESE.search(content):
            yield line, '普通注释必须使用中文，可混用技术术语'


def overload_signatures(tree: ast.Module) -> set[ast.AST]:
    """
    识别由 typing 声明且在同一作用域有具体实现的重载签名。

    :param tree: 待校验源码的抽象语法树
    :return: 已由具体实现提供文档的重载声明
    """
    decorators = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module in {'typing', 'typing_extensions'}:
            decorators.update(alias.asname or alias.name for alias in node.names if alias.name == 'overload')
        elif isinstance(node, ast.Import):
            decorators.update(
                f'{alias.asname or alias.name}.overload'
                for alias in node.names
                if alias.name in {'typing', 'typing_extensions'}
            )
    if not decorators:
        return set()
    signatures = set()
    for parent in ast.walk(tree):
        for _, suite in ast.iter_fields(parent):
            if not isinstance(suite, list):
                continue
            implementations = set()
            for definition in reversed(suite):
                if not isinstance(definition, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                if not any(ast.unparse(item) in decorators for item in definition.decorator_list):
                    implementations.add(definition.name)
                elif definition.name in implementations:
                    signatures.add(definition)
    return signatures


def exception_names(expr: ast.expr | None) -> tuple[str, ...]:
    """
    读取异常名称或元组中的各个异常类型。

    :param expr: 捕获或抛出的异常表达式
    :return: 源码中可识别的异常类型名称
    """
    if expr is None:
        return ('BaseException',)
    if isinstance(expr, ast.Tuple):
        return tuple(name for child in expr.elts for name in exception_names(child))
    if isinstance(expr, ast.Call):
        expr = expr.func
    if isinstance(expr, (ast.Attribute, ast.Name)):
        name = ast.unparse(expr)
        if name.split('.')[-1][:1].isupper():
            return (name,)
    return ()


def catches_exception(name: str, handlers: set[str]) -> bool:
    """
    比对处理器捕获的类型，包括内置异常的继承关系。

    :param name: 抛出异常的名称
    :param handlers: 当前受保护范围内的捕获类型
    :return: 该异常是否已由本地处理器捕获
    """
    short = name.rsplit('.', 1)[-1]
    exception = getattr(builtins, short, None)
    if isinstance(exception, type) and issubclass(exception, BaseException):
        return any(cls.__name__ in handlers for cls in exception.__mro__)
    return bool({short, 'BaseException'} & handlers or ('Exception' in handlers and short != 'CancelledError'))


def function_outcomes(function: ast.FunctionDef | ast.AsyncFunctionDef) -> Iterator[tuple[str, ast.AST]]:
    """
    定位当前函数返回或生成的值以及显式抛出的未捕获异常。

    :param function: 要检查的函数定义
    :yield: 应记录的字段名称及其来源语句
    """

    def visit(
        node: ast.AST, caught: set[str], active: tuple[str, ...], alias: str | None
    ) -> Iterator[tuple[str, ast.AST]]:
        """
        在当前处理器作用域内查找对调用方可见的结果。

        :param node: 当前语法节点
        :param caught: 外层处理器捕获的异常类型
        :param active: 当前正在处理的异常类型
        :param alias: 当前处理器绑定的异常变量
        :yield: 结果字段和对应的语法节点
        """
        if isinstance(node, (*DEFINITIONS, ast.Lambda)):
            return
        if isinstance(node, (ast.Try, ast.TryStar)):
            local = {name.split('.')[-1] for h in node.handlers for name in exception_names(h.type)}
            for stmt in node.body:
                yield from visit(stmt, caught | local, active, alias)
            for handler in node.handlers:
                for stmt in handler.body:
                    yield from visit(stmt, caught, exception_names(handler.type), handler.name)
            for stmt in (*node.orelse, *node.finalbody):
                yield from visit(stmt, caught, active, alias)
            return
        if isinstance(node, (ast.Yield, ast.YieldFrom)):
            yield 'yield', node
        elif (
            isinstance(node, ast.Return)
            and node.value is not None
            and not (isinstance(node.value, ast.Constant) and node.value.value is None)
        ):
            yield 'return', node
        elif isinstance(node, ast.Raise):
            reraised = node.exc is None or (isinstance(node.exc, ast.Name) and node.exc.id == alias)
            names = active if reraised else exception_names(node.exc)
            for name in names or ('',):
                if not catches_exception(name, caught):
                    yield f'raises {name}'.rstrip(), node
        for child in ast.iter_child_nodes(node):
            yield from visit(child, caught, active, alias)

    for statement in function.body:
        yield from visit(statement, set(), (), None)
    if function.returns and isinstance(function.body[-1], (ast.Pass, ast.Expr)):
        stub = isinstance(function.body[-1], ast.Pass) or (
            isinstance(function.body[-1].value, ast.Constant) and function.body[-1].value.value is Ellipsis
        )
        if stub and ast.unparse(function.returns).split('.')[-1] not in {'None', 'Never', 'NoReturn'}:
            yield 'return', function


def violations(
    tree: ast.Module, settings: frontend.Values, path: Path = Path('sample.py')
) -> Iterator[tuple[int, str]]:
    """
    拒绝模块文档字符串，校验每个类和函数实现的文档字符串。

    :param tree: 待校验源码的抽象语法树
    :param settings: Sphinx 解析器配置
    :param path: 源文件路径，用于解析模型的导入关系
    :yield: 违规位置的源码行号和诊断信息
    """
    if path.resolve() == ALEMBIC_ENV:
        return
    if ast.get_docstring(tree, clean=False) is not None:
        yield tree.body[0].lineno, '请移除文件顶部的模块 docstring，将说明写在对应的类或函数上'
    methods = {item for cls in ast.walk(tree) if isinstance(cls, ast.ClassDef) for item in scoped_statements(cls.body)}
    routes, route_errors = inspect_routes(tree)
    yield from route_errors
    router = preserved_router(tree, path)
    preserved = set(ast.walk(router)) if router else set()
    tables = {}
    models = {node: info for node, info in model_classes(tree, path, tables).items() if node not in preserved}
    yield from table_field_errors(tables)
    for node, (kind, bindings) in models.items():
        yield from model_field_errors(node, kind, bindings)
    tests = test_functions(tree, path)
    overloads = overload_signatures(tree)
    for node in ast.walk(tree):
        if not isinstance(node, DEFINITIONS) or node in preserved:
            continue
        doc = ast.get_docstring(node, clean=False)
        if doc is None and (node in routes or node in overloads):
            continue
        if node in overloads:
            yield node.lineno, f'请将 {node.name} 的文档写在重载的具体实现上'
            continue
        if doc is None:
            yield node.lineno, f'{node.name} 缺少 Sphinx/reST docstring'
            continue
        expression = node.body[0]
        if not doc.strip():
            yield expression.lineno, '请填写文档摘要'
            continue
        start = expression.lineno + next(i for i, line in enumerate(doc.splitlines()) if line.strip())
        parameters = parameters_for(node, methods)
        required = {}
        if isinstance(node, ast.ClassDef) and not models[node][0]:
            required = dict.fromkeys(class_attributes(node), 'variable')
        elif not isinstance(node, ast.ClassDef) and parameters is not None and node not in tests and node not in routes:
            required = dict.fromkeys((name for name in parameters.names if name.isidentifier()), 'parameter')
        yield from check_docstring(doc, parameters, start, settings, required, node, node in tests, node in routes)
        for identifier, kind in sorted(required.items()):
            label = (
                f'参数 {identifier} 缺少 :param' if kind == 'parameter' else f'属性 {identifier} 缺少 :ivar 或 :cvar'
            )
            yield start, f'{label} 描述'


def check_docstring(
    doc: str,
    parameters: Parameters | None,
    start: int,
    settings: frontend.Values,
    required: dict[str, str],
    owner: ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef,
    is_test: bool,
    is_route: bool,
) -> Iterator[tuple[int, str]]:
    """
    解析单个文档，返回标记、字段和排版诊断的源码位置。

    :param doc: 原始文档字符串
    :param parameters: 文档对应的签名信息
    :param start: 摘要在源文件中的行号
    :param settings: Sphinx 解析器配置
    :param required: 需要在文档中逐项说明的名称及字段类别
    :param owner: 声明文档的类或函数
    :param is_test: 当前函数是否会被 pytest 收集
    :param is_route: 当前函数是否为路由端点
    :yield: 违规位置的源码行号和诊断信息
    """
    lines = prepare_docstring(doc)
    if not lines[0].endswith(('.', '。', '!', '！', '?', '？')):
        yield start, '请以句末标点结束文档摘要'
    if not CHINESE.search(lines[0]):
        yield start, '文档摘要必须使用中文，可混用技术术语'
    document = utils.new_document('<docstring>', settings)
    messages: list[nodes.system_message] = []
    document.reporter.attach_observer(messages.append)
    settings.env.prepare_settings('docstring')
    try:
        with sphinx_domains(settings.env):
            Parser().parse('\n'.join(lines), document)
    except SphinxWarning as error:
        yield start, str(error)
    for message in messages:
        if message['level'] >= utils.Reporter.WARNING_LEVEL:
            description: nodes.Node = message.children[0]
            yield start + (message.get('line') or 1) - 1, description.astext()
    fields = []
    for block in document.findall(nodes.Element):
        if block.line is None:
            continue
        lineno = start + block.line - 1
        if isinstance(block, nodes.field) and isinstance(block.parent.parent, (nodes.document, nodes.section)):
            fields.append(block)
            if error := field_error(block, parameters, required):
                yield lineno, error
        elif isinstance(block, (nodes.paragraph, nodes.term, nodes.title)):
            yield from check_prose(block, lineno)
    if not is_route:
        yield from check_contract(fields, owner, is_test, start)


def check_contract(
    fields: list[nodes.field],
    owner: ast.ClassDef | ast.FunctionDef | ast.AsyncFunctionDef,
    is_test: bool,
    start: int,
) -> Iterator[tuple[int, str]]:
    """
    对照声明种类、函数体和顶层字段检查文档约定。

    :param fields: 文档中用于说明接口的字段
    :param owner: 定义该文档的类或函数
    :param is_test: 是否为测试用例
    :param start: 摘要在源码中的位置
    :yield: 不符合约定的行号和说明
    """
    documented = set()
    params = set()
    attributes = set()
    for field in fields:
        name, *args = field[0].astext().split()
        kind = FIELD_KINDS.get(name)
        if kind in {'returnvalue', 'yieldvalue'}:
            documented.add('return' if kind == 'returnvalue' else 'yield')
        elif kind == 'exceptions' and args:
            documented.update(('raises', 'raises ' + args[-1].split('.')[-1]))
        elif kind == 'parameter' and args:
            params.add(args[-1])
        elif kind == 'variable' and args:
            attributes.add(args[-1])
    if is_test:
        if fields:
            yield start, '测试函数只写测试意图，请移除接口字段'
        return
    if isinstance(owner, ast.ClassDef):
        for name in sorted(params & attributes):
            yield start, f'类属性 {name} 重复使用参数和属性字段，请只保留属性说明'
        return
    required = {
        field if '.' not in field else 'raises ' + field.split('.')[-1] for field, _ in function_outcomes(owner)
    }
    for key in sorted(required - documented):
        field_name = 'raises 异常类型' if key == 'raises' else key
        yield start, f'缺少 :{field_name}: 描述'


def check_prose(block: nodes.Element, start: int) -> Iterator[tuple[int, str]]:
    """
    识别正文和标题中的其他 API 文档风格。

    :param block: 待检查的 reST 正文节点
    :param start: 正文在源文件中的起始行号
    :yield: 违规位置的源码行号和诊断信息
    """
    source = block.rawsource
    parent = block.parent
    type_field = (
        isinstance(parent, nodes.field_body)
        and isinstance(parent.parent, nodes.field)
        and FIELD_KINDS.get(parent.parent[0].astext().split()[0], '')
        in {
            'returntype',
            'parametertype',
            'variabletype',
            'meta',
        }
    )
    if (
        not type_field
        and re.search('[a-zA-Z]', source)
        and not CHINESE.search(block.astext())
        and not all(isinstance(child, (nodes.literal, nodes.reference)) for child in block.children)
    ):
        yield start, '文档说明必须使用中文，可混用技术术语'
    for inline in block.findall(nodes.Inline):
        markup = inline.rawsource
        if markup.startswith('`') and not markup.startswith('```'):
            source = source.replace(markup, '…' + '\n' * markup.count('\n'), 1)
    is_title = isinstance(block, nodes.title)
    # Docutils 将章节标题定位到标题下方的装饰线。
    for index, raw in enumerate(source.splitlines(), start - int(is_title)):
        line = raw.strip()
        section = SECTION.fullmatch(line)
        if section and (section[1] or is_title):
            yield index, f'章节 {line} 请改用 reST 字段或指令'
        elif FOREIGN_MARKUP.match(line) or MARKDOWN_LINK.search(line):
            yield index, f'请将 {line} 改为 reST 字段、标题或代码块'
        elif UNPARSED_LITERAL.search(line):
            yield index, '行内字面量的双反引号必须成对，并与相邻正文分隔'
        elif line.startswith(':') and line != '::' and not ROLE.match(line):
            yield index, f'请使用独立的 reST 字段列表，格式为 :字段 名称: 描述；当前为 {line}'


def main(targets: list[str]) -> int:
    """
    使用与 Ruff 相同的目标文件和排除规则，发现违规时返回非零状态。

    :param targets: 交给 Ruff 解析的文件或目录
    :return: 检查通过时为零，否则为非零退出码
    """
    files = subprocess.run(
        [sys.executable, '-m', 'ruff', 'check', '--show-files', '--', *targets],
        stdout=subprocess.PIPE,
        encoding='utf-8',
        check=False,
    )
    if files.returncode:
        return files.returncode
    failed = False
    with sphinx_settings() as settings:
        for path in map(Path, files.stdout.splitlines()):
            if path.suffix not in {'.py', '.pyi', '.pyw'} or path.resolve() == ALEMBIC_ENV:
                continue
            with tokenize.open(path) as stream:
                source = stream.read()
            tree = ast.parse(source, filename=str(path))
            for lineno, error in (
                *header_comments(source),
                *comment_language(source, tree, path),
                *violations(tree, settings, path),
            ):
                print(f'{path}:{lineno}: {error}')
                failed = True
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
