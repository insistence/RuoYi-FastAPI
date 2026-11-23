import ast
import json
import subprocess
import sys
from collections.abc import Callable, Iterator
from pathlib import Path
from textwrap import indent

import pytest

from scripts.check_docstrings import (
    ALEMBIC_ENV,
    ROUTER_MODULE,
    comment_language,
    header_comments,
    sphinx_settings,
    violations,
)


@pytest.fixture(scope='module')
def check() -> Iterator[Callable[..., list[tuple[int, str]]]]:
    """
    为源码样例提供共享的 Sphinx 检查环境。

    :yield: 逐项产生的 ``parse``
    """
    with sphinx_settings() as settings:

        def parse(source: str, path: Path = Path('sample.py')) -> list[tuple[int, str]]:
            """
            收集样例源码的文件头与 docstring 诊断。

            :param source: 要检查的 Python 源码
            :param path: 源文件的位置，用于匹配路径规则和解析本地导入
            :return: 样例源码的文件头与 docstring 诊断
            """
            tree = ast.parse(source)
            return [*header_comments(source), *comment_language(source, tree, path), *violations(tree, settings, path)]

        yield parse


@pytest.mark.parametrize(
    'body',
    [
        'Args:\n    value: 输入值',
        'Parameters\n----------\nvalue : int\n    输入值',
        ':param value: 输入值\n\nReturns:\n    int',
        ':parma value: 输入值',
        ':param typo: 输入值',
        ':param value 缺少结束冒号',
        ':param  : 缺少参数名',
        ':raises: 缺少异常类型',
        '@param value: 输入值',
        '## 示例',
        '```python\nprint(1)\n```',
        '[说明](https://example.com)',
        ':yield value: 数据块',
        ':ytype: bytes',
        ':return:',
        ':param value:',
        ':type int value: int',
        ':param int or str value: 输入值',
        '.. invalid-directive::',
        '.. code-block:: python\n    :unknown-option:\n\n    print(1)',
        '调用 :py:met:`str.strip`。',
        '未闭合的 **strong 标记。',
        '请使用``convert``转换。',
    ],
)
def test_rejects_non_rest_and_invalid_fields(body: str, check: Callable) -> None:
    """拒绝非 reST 标记和无效字段。"""
    source = 'async def convert(value):\n    """\n    转换输入。\n\n' + indent(body, '    ') + '\n    """'
    assert any('缺少 :param 描述' not in error for _, error in check(source))


@pytest.mark.parametrize('prefix', ['class Example:\n', 'def example():\n', 'async def example():\n'])
def test_checks_each_docstring_owner(prefix: str, check: Callable) -> None:
    """逐一校验类、同步函数和异步函数的文档。"""
    doc = '"""示例。\n\nArgs:\n    value: 输入值\n"""'
    source = prefix + indent(doc, '    ')
    assert (4, '章节 Args: 请改用 reST 字段或指令') in check(source)


@pytest.mark.parametrize(
    ('body', 'line'),
    [
        ('Parameters\n----------\nvalue : int\n    输入值', 4),
        ('.. note::\n\n    Args:\n        value: 输入值', 6),
        (':param value: 输入值\n未缩进的说明。\n:return: 转换结果', 6),
    ],
)
def test_reports_source_line_for_misplaced_markup(body: str, line: int, check: Callable) -> None:
    """标记放错位置时报告实际源码行号。"""
    source = 'def example(value):\n' + indent('"""说明。\n\n' + body + '\n"""', '    ')
    assert line in [lineno for lineno, _ in check(source)]


def test_allows_rest_fields_roles_and_examples(check: Callable) -> None:
    """接受合法的 reST 字段、角色和示例。"""
    source = '''
def convert(value, /, *items, flag=True, **options):
    """
    转换输入。

    :param int value: 输入值
        此行继续说明该参数。
    :param items: 其余输入值
    :param flag: 转换开关
    :param options: 扩展选项
    :keyword mode: 通过 options 传入的模式
    :type mode: str or None
    :return: 转换结果
    :rtype: str
    :raises ValueError: 输入无效
    :meta private:

    :py:meth:`str.strip` 处理的示例::

        Args:
        :parma name: 示例文本

    .. code-block:: python
        :linenos:

        print("Parameters")

    >>> print("Args:")
    Args:

    链接写法见 `说明 <https://example.com>`_。字面文本为 ``[说明](https://example.com)``。
    """
    template = """Args:
        value: 普通字符串
    """
'''
    assert not check(source)


def test_checks_summary_punctuation_and_constructor_signature(check: Callable) -> None:
    """校验摘要标点和构造函数签名。"""
    assert check('def example():\n    """缺少句号"""') == [(2, '请以句末标点结束文档摘要')]
    source = 'class Example:\n    """示例。\n\n    :param typo: 输入\n    """\n    def __init__(self, value):\n        """保存输入值。"""'
    assert check(source) == [(4, '文档参数 typo 不在函数签名中'), (7, '参数 value 缺少 :param 描述')]


def test_file_header_boundary(check: Callable) -> None:
    """验证文件头边界，并保留解释器声明和代码内部注释。"""
    assert [line for line, _ in check('\n# 说明\n"""模块文档。"""\n')] == [2, 3]
    assert check('#!/usr/bin/env python3\n# coding: utf-8\nimport os  # 行尾注释\n# 内部注释') == []
    assert check('# 说明') and check('#!/usr/bin/env python3\n\n# coding: utf-8')
    assert check('description = """普通字符串。"""') == []


def test_missing_private_nested_and_async_docs(check: Callable) -> None:
    """检查类、特殊方法、私有函数和嵌套异步函数的覆盖范围。"""
    source = 'class _Type:\n    def __init__(self):\n        async def _inner(): pass\n\ndef _helper(): pass'
    assert sorted(line for line, _ in check(source)) == [1, 2, 3, 5]


def test_overload_uses_implementation_documentation(check: Callable) -> None:
    """验证类型重载共用实现文档，并要求实现存在。"""
    stub = 'from typing import overload as signature\n@signature\ndef f(x: int) -> int: ...\n'
    assert check(stub)
    assert check(stub + 'def f(x): pass') == [(4, 'f 缺少 Sphinx/reST docstring')]
    assert not check(
        stub + 'def f(x):\n    """\n    返回输入值。\n\n    :param x: 输入值\n    :return: 原值\n    """\n    return x'
    )


def test_requires_parameter_descriptions(check: Callable) -> None:
    """验证各类显式参数必须有描述，类型字段和代码块不能代替参数说明。"""
    source = '''
class Factory:
    """示例工厂。"""

    @staticmethod
    async def create(self, /, *items, mode, **options):
        """
        创建示例。

        :type self: str
        :param items: 位置参数
        :keyword mode: 创建模式
        :keyword timeout: 超时秒数

        示例::

            :param options: 仅用于展示
        """
'''
    assert {message for _, message in check(source)} == {'参数 self 缺少 :param 描述', '参数 options 缺少 :param 描述'}


def test_requires_class_and_instance_attribute_descriptions(check: Callable) -> None:
    """验证声明、解包赋值和实例属性的覆盖，排除局部变量与其他对象的属性。"""
    source = '''
class Result:
    """结果。

    :cvar version: 格式版本
    :ivar count: 记录数
    :vartype _active: bool
    """

    version = 1
    count: int
    def __init__(self):
        """初始化状态。"""
        self.count, self._active = 0, True
        local = self
        local.foreign = 1
'''
    assert [message for _, message in check(source)] == ['属性 _active 缺少 :ivar 或 :cvar 描述']
    slots = 'class Record:\n    """一条记录。\n\n    :ivar name: 名称\n    """\n    __slots__ = ("name", "count")'
    assert [message for _, message in check(slots)] == ['属性 count 缺少 :ivar 或 :cvar 描述']


def test_model_exemption_follows_imports_without_running_model_code(tmp_path: Path, check: Callable) -> None:
    """验证单文件检查能沿导入和别名识别模型，同时检查普通类和模型方法。"""
    (tmp_path / 'base_types.py').write_text(
        'from pydantic import BaseModel as Schema\nfrom sqlalchemy.orm import registry\n'
        'mapper = registry()\nOrm = mapper.generate_base()\nclass Payload(Schema): pass\n'
        'raise RuntimeError("source only")\n',
        encoding='utf-8',
    )
    source = '''
import base_types as bases
from base_types import Orm
class Child(bases.Payload):
    """载荷。"""
    value: int
    def normalize(self, scale):
        """转换数值。"""
class Table(Orm):
    """数据表。"""
    field = 1
class BaseModel:
    """普通同名类。"""
    flag: bool
'''
    errors = check(source, tmp_path / 'models.py')
    assert {message for _, message in errors} == {
        '属性 flag 缺少 :ivar 或 :cvar 描述',
        '参数 scale 缺少 :param 描述',
        'Child.value 必须填写含中文的 description',
    }


def test_pydantic_fields_require_descriptions(check: Callable) -> None:
    """校验有效的字段说明，覆盖别名、类型元数据、计算字段及类变量。"""
    source = '''
from typing import Annotated, ClassVar as Shared
from pydantic import BaseModel, Field as F, computed_field
from pydantic_settings import BaseSettings
LABEL = '项目名称'
EMPTY = ' '
Label = Annotated[str, F(description=LABEL)]
class Options(BaseSettings):
    """应用配置。"""
    model_config = {}
    _private: str
    shared: 'Shared[int]' = 1
    label: Label
    deferred: 'Label'
    limited: Label = F(min_length=1)
    bare: int
    blank: str = F(description=EMPTY)
    english: str = F(description='English only')
    cleared: Label = F(description=None)
    items: list[Annotated[str, F(description=LABEL)]]
class Payload(BaseModel):
    """模型载荷。"""
    @computed_field
    @property
    def total(self):
        """统计总量。"""
    @computed_field(description='有效数量')
    @property
    def count(self):
        """统计有效数量。"""
'''
    errors = {msg for _, msg in check(source)}
    assert errors == {
        *(f'Options.{name} 必须填写含中文的 description' for name in ('bare', 'blank', 'english', 'cleared', 'items')),
        'Payload.total 必须填写含中文的 description',
    }


def test_sqlalchemy_columns_require_comments(check: Callable) -> None:
    """检查实际映射列、复用类型和显式表定义，仅对关系属性免除列说明。"""
    source = '''
import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column as col, relationship
from typing import Annotated
Key = Annotated[int, col(comment='记录标识')]
standalone = sa.Table('log', metadata, sa.Column('event', sa.String))
class Record(DeclarativeBase):
    """映射记录。"""
    id: Mapped[Key] = col(primary_key=True)
    name = sa.Column(sa.String, doc='名称')
    score: Mapped[int]
    parent: Mapped['Record'] = relationship()
    size: Mapped[int] = col(comment='')
class Other(DeclarativeBase):
    """显式数据表。"""
    __table__ = sa.Table('other', metadata, sa.Column('id', sa.Integer))
class Mix:
    """声明列的混入类。"""
    @declared_attr
    def stamp(cls):
        """
        创建时间列。

        :return: 时间列
        """
        return col()
'''
    messages = {msg for _, msg in check(source)}
    assert messages == {
        *(f'Record.{name} 必须填写含中文的 comment' for name in ('name', 'score', 'size')),
        'other.id 必须填写含中文的 comment',
        'log.event 必须填写含中文的 comment',
        'Mix.stamp 必须填写含中文的 comment',
    }


def test_routes_and_test_functions_have_distinct_requirements(tmp_path: Path, check: Callable) -> None:
    """验证装饰器、显式注册及 pytest 例外的边界。"""
    source = '''
from fastapi import APIRouter as Router
api = Router()
@api.get('/items', summary='查询条目', description='按条件列出匹配的条目。')
def items(value): pass
def detail(key): pass
api.add_api_route('/detail', endpoint=detail, summary='查询详情', description='按键返回条目详情。')
def test_items(client):
    """测试列表路由。"""
def test_detail(client): pass
def build(key):
    """生成测试数据。"""
@cache.get('/else')
def ordinary(key): pass
'''
    errors = check(source, tmp_path / 'test_routes.py')
    assert {message for _, message in errors} == {
        'test_detail 缺少 Sphinx/reST docstring',
        'ordinary 缺少 Sphinx/reST docstring',
        '参数 key 缺少 :param 描述',
    }


def test_every_http_registration_requires_chinese_summary_and_description(check: Callable) -> None:
    """验证同一端点的每次注册、隐藏操作和外部回调各自声明中文元数据。"""
    source = '''
from fastapi import APIRouter as Router
from elsewhere import handler
router = Router()
api = router
EMPTY = '  '
DOCS = {'summary': '查询事项', 'description': '返回全部事项。'}
@api.get('/ok', **DOCS)
@api.post('/other', summary='新增事项')
def items():
    """处理事项。"""
@router.api_route('/hidden', methods=['GET'], include_in_schema=False, summary=None, description=EMPTY)
def hidden(): pass
router.add_api_route('/external', endpoint=handler, summary='English only', description='返回状态。')
router.add_api_route('/wrapped', plugin_endpoint(handler), summary='查询状态')
@api.websocket('/ws')
def events(socket): pass
api.add_route('/docs', handler, include_in_schema=False)
'''
    assert check(source) == [
        (9, 'HTTP 路由必须填写含中文的 description'),
        (12, 'HTTP 路由必须填写含中文的 summary'),
        (12, 'HTTP 路由必须填写含中文的 description'),
        (14, 'HTTP 路由必须填写含中文的 summary'),
        (15, 'HTTP 路由必须填写含中文的 description'),
    ]


def test_programmatic_routes_and_factory_router_share_the_http_rules(check: Callable) -> None:
    """验证直接注册路径操作对象及通过工厂取得的路由器都逐条检查。"""
    source = '''
from fastapi import APIRouter
from fastapi.routing import APIRoute as Operation
def make_router() -> APIRouter:
    """
    创建路由器。

    :return: 应用路由器
    """
    return APIRouter()
router = make_router()
def handler(): pass
routes = [Operation('/one', handler, summary='读取记录')]
router.get('/two', description='读取单条记录。')(handler)
'''
    assert [message for _, message in check(source)] == [
        'HTTP 路由必须填写含中文的 description',
        'HTTP 路由必须填写含中文的 summary',
    ]


def test_preserves_alembic_and_only_the_original_router_class(check: Callable) -> None:
    """验证特例按源文件和类定位，同一文件的其他定义继续受检。"""
    source = 'class APIRouterPro:\n    def __init__(self): pass\nclass RouterRegister: pass'
    assert not check(source, ALEMBIC_ENV)
    assert check(source, ROUTER_MODULE) == [(3, 'RouterRegister 缺少 Sphinx/reST docstring')]


def test_generator_documents_each_observable_outcome(check: Callable) -> None:
    """生成器应分别说明生成值、最终返回值和传给调用方的异常。"""
    source = '''
def stream(value):
    """
    生成输入项。

    :param value: 待处理的值
    """
    try:
        if value is None:
            raise KeyError()
    except LookupError:
        return
    if value < 0:
        raise ValueError()
    yield value
    return value + 1
'''
    assert {message for _, message in check(source)} == {
        '缺少 :yield: 描述',
        '缺少 :return: 描述',
        '缺少 :raises ValueError: 描述',
    }
    documented = source.replace(
        '待处理的值', '待处理的值\n    :yields: 输入项\n    :returns: 下一项\n    :raises ValueError: 输入为负数'
    )
    assert not check(documented)


def test_async_generator_and_reraised_exception(check: Callable) -> None:
    """异步生成器记录生成值及重新抛出的异常，嵌套函数单独校验。"""
    source = '''
async def stream():
    """提供数据。"""
    def helper():
        """返回输入值。

        :return: 固定的整数
        """
        return 1
    try:
        yield helper()
    except OSError as exc:
        raise exc
'''
    assert {message for _, message in check(source)} == {'缺少 :yield: 描述', '缺少 :raises OSError: 描述'}
    assert not check('def finish():\n    """结束会话。"""\n    return None')


def test_test_functions_only_describe_intent(check: Callable) -> None:
    """测试用例拒绝普通函数可用的参数字段和返回值字段。"""
    source = (
        'def test_value(x):\n    """\n    检查数值。\n\n    :param x: 输入值\n    :return: 数值\n    """\n    return x'
    )
    assert not check(source)
    assert check(source, Path('test_value.py')) == [(3, '测试函数只写测试意图，请移除接口字段')]
    assert not check('def test_value(x):\n    """检查数值。"""', Path('test_value.py'))
    fixture = 'from pytest import fixture as resource\n@resource()\n' + source
    assert not check(fixture, Path('test_value.py'))


def test_chinese_prose_and_class_field_overlap(check: Callable) -> None:
    """中英文可混用，英文段落、字段描述、普通注释及重复属性说明会被识别。"""
    source = 'class Item:\n    """保存 ID。\n\n    :param id: 标识\n    :ivar id: Identifier\n    """\n    id: int'
    errors = [message for _, message in check(source)]
    assert any('字段须用中文' in message for message in errors)
    assert any('重复使用参数和属性字段' in message for message in errors)
    assert check('def read():\n    """Read ID."""')
    assert check('def read():\n    """读取 ID。\n\n    English prose.\n    """')
    assert check('value = 1  # Accept input.')
    assert not check('value = 1  # 接受 ID\nvalue = 2  # noqa: F841')


@pytest.mark.parametrize('directory', ['ruoyi-fastapi-backend', 'ruoyi-fastapi-test', '.github'])
def test_ruff_requires_all_multiline_summaries_on_second_line(directory: str) -> None:
    """三处 Ruff 配置均拒绝多行摘要紧接引号，并接受单行摘要及正确换行的文档。"""
    config = ROUTER_MODULE.parents[2] / directory / 'ruff.toml'
    source = '''
class Example:
    """类说明。

    更多说明。
    """

    def read(self) -> int:
        """读取条数。

        :return: 条数
        """
        return 1

async def stream():
    """生成数据。

    :yield: 数据块
    """
    yield 1

def test_value():
    """验证输入。

    说明测试场景。
    """

def single():
    """单行摘要。"""

def correctly_wrapped():
    """
    正确的多行摘要。

    附加说明。
    """
'''
    run = subprocess.run(
        [sys.executable, '-m', 'ruff', 'check', '--config', str(config), '--output-format=json', '--no-cache', '-'],
        input=source,
        capture_output=True,
        encoding='utf-8',
        check=False,
    )
    diagnostics = json.loads(run.stdout)
    assert [item['location']['row'] for item in diagnostics if item['code'] == 'D213'] == [3, 9, 16, 23]
