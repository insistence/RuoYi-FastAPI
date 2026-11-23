from pathlib import Path

from cli.exit_codes import DEPENDENCY_ERROR, RUNTIME_ERROR
from cli.runtime.base import RuntimeEnvironmentService
from cli.runtime.dev import DevelopmentRuntimeService
from cli.runtime.dev.gateway import DevelopmentProcessGateway
from cli.runtime.dev.support import DevelopmentCommandSupport, DevelopmentToolingSupport


def test_lint_reports_route_metadata_even_when_function_has_docstring(tmp_path: Path) -> None:
    """验证 CLI 能报告具体注册位置及缺失的接口说明。"""
    target = tmp_path / 'routes.py'
    target.write_text(
        "from fastapi import FastAPI\n\napp = FastAPI()\n\n\n@app.get('/items', summary='查询事项')\n"
        'def items() -> None:\n    """返回全部事项。"""\n',
        encoding='utf-8',
    )
    payload = DevelopmentRuntimeService().run_lint([str(target)], check_only=True)
    assert payload['exit_code'] == RUNTIME_ERROR
    assert 'routes.py:6: HTTP 路由必须填写含中文的 description' in payload['docstrings']['stdout']


def test_dev_lint_fails_for_bad_docstring(tmp_path: Path) -> None:
    """文档违规时开发检查命令返回失败。"""
    target = tmp_path / 'sample.py'
    target.write_text(
        'def sample() -> int:\n    """\n    示例。\n\n    Returns:\n        int\n    """\n    return 1\n',
        encoding='utf-8',
    )
    payload = DevelopmentRuntimeService().run_lint([str(target)], check_only=True)
    assert payload['format']['ok']
    assert payload['check']['ok']
    assert not payload['ok']
    assert payload['exit_code'] == RUNTIME_ERROR
    assert 'sample.py:5:' in payload['docstrings']['stdout']
    assert '请改用 reST 字段或指令' in payload['docstrings']['stdout']


class FakeRuntimeEnvironment(RuntimeEnvironmentService):
    """模拟运行时环境服务。"""

    @staticmethod
    def get_backend_dir() -> str:
        """
        返回固定后端目录。

        :return: 固定目录
        """
        return '/tmp/ruoyi-backend'

    @staticmethod
    def get_python_executable() -> str:
        """
        返回固定 Python 可执行文件。

        :return: Python 可执行文件路径
        """
        return '/usr/bin/python3'


def test_development_runtime_service_returns_dependency_error_when_pytest_missing() -> None:
    """校验开发运行时在 pytest 缺失时会返回依赖错误结果。"""

    class FakeToolingSupport(DevelopmentToolingSupport):
        """模拟开发工具支持对象。"""

        @staticmethod
        def is_pytest_available() -> bool:
            """
            返回 pytest 不可用状态。

            :return: 布尔值 False
            """
            return False

    service = DevelopmentRuntimeService(
        runtime_environment=FakeRuntimeEnvironment(),
        tooling_support=FakeToolingSupport(),
    )

    payload = service.run_tests(['tests/cli'])

    assert payload == {
        'ok': False,
        'message': 'pytest 未安装，无法执行 dev test',
        'hint': '请在当前环境安装 pytest 后重试',
        'exit_code': DEPENDENCY_ERROR,
    }


def test_development_runtime_service_run_lint_uses_command_support() -> None:
    """校验开发运行时会通过命令支持对象串联 format/check 执行流程。"""

    class FakeCommandSupport(DevelopmentCommandSupport):
        """
        模拟开发命令支持对象。

        :ivar recorded_commands: 按执行顺序保存的命令
        """

        def __init__(self) -> None:
            """初始化测试夹具的 ``recorded_commands``。"""
            self.recorded_commands: list[list[str]] = []

        def build_format_command(self, normalized_targets: list[str], *, check_only: bool) -> list[str]:
            """
            校验格式化参数并返回测试命令。

            :param normalized_targets: 已规整目标列表
            :param check_only: 是否只报告检查结果
            :return: 测试命令
            """
            assert normalized_targets == ['tests/cli']
            assert check_only is True
            return ['format-command']

        def build_check_command(
            self,
            normalized_targets: list[str],
            *,
            check_only: bool,
            fix: bool,
            unsafe_fixes: bool,
        ) -> list[str]:
            """
            校验检查参数并提供静态检查命令。

            :param normalized_targets: 已规整目标列表
            :param check_only: 是否只报告检查结果
            :param fix: 是否应用可用的修复
            :param unsafe_fixes: 是否允许不安全修复
            :return: 供断言比对的静态检查命令
            """
            assert normalized_targets == ['tests/cli']
            assert check_only is True
            assert fix is False
            assert unsafe_fixes is False
            return ['check-command']

    class FakeProcessGateway(DevelopmentProcessGateway):
        """
        模拟开发子进程执行网关。

        :ivar recorded_commands: 按执行顺序保存的命令
        """

        def __init__(self) -> None:
            """初始化测试夹具的 ``recorded_commands``。"""
            self.recorded_commands: list[list[str]] = []

        def run_command(self, command: list[str]) -> dict[str, object]:
            """
            捕获开发命令并返回测试执行结果。

            :param command: 执行的命令及其参数
            :return: 测试执行结果
            """
            self.recorded_commands.append(command)
            return {'ok': True, 'command': command, 'returnCode': 0}

    command_support = FakeCommandSupport()
    process_gateway = FakeProcessGateway()
    service = DevelopmentRuntimeService(
        runtime_environment=FakeRuntimeEnvironment(),
        command_support=command_support,
        process_gateway=process_gateway,
    )

    payload = service.run_lint(['tests/cli'], check_only=True)

    assert payload['ok'] is True
    assert payload['targets'] == ['tests/cli']
    assert process_gateway.recorded_commands == [
        ['format-command'],
        ['check-command'],
        ['/usr/bin/python3', 'scripts/check_docstrings.py', 'tests/cli'],
    ]
