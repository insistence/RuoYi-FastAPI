import json
import os
import subprocess
import sys
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

import pytest

CLI_PROCESS_TIMEOUT_SECONDS = 60


@pytest.fixture
def backend_dir() -> Path:
    """
    提供测试使用的后端工程根目录。

    :return: 测试使用的后端工程根目录
    """
    return Path(__file__).resolve().parents[3]


@pytest.fixture
def run_cli_command(backend_dir: Path) -> Callable[..., subprocess.CompletedProcess[str]]:
    """
    提供执行 CLI 子进程并捕获输出的测试入口。

    :param backend_dir: 后端项目目录
    :return: 执行 CLI 子进程并捕获输出的测试入口
    """

    def _run_cli_command(*args: str, env: Mapping[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        """
        运行指定 CLI 命令并收集退出码和输出。

        :param args: 传给被调用对象的位置参数
        :param env: 当前运行环境
        :return: 包含退出码和标准输出、错误输出的子进程结果
        """
        return subprocess.run(
            [sys.executable, '-X', 'utf8', '-m', 'cli.main', *args],
            cwd=backend_dir,
            env=env,
            capture_output=True,
            text=True,
            encoding='utf-8',
            check=False,
            timeout=CLI_PROCESS_TIMEOUT_SECONDS,
        )

    return _run_cli_command


@pytest.fixture
def run_text_cli_command(
    run_cli_command: Callable[..., subprocess.CompletedProcess[str]],
) -> Callable[..., subprocess.CompletedProcess[str]]:
    """
    提供纯文本输出模式的 CLI 调用入口。

    :param run_cli_command: 执行 CLI 子命令并返回进程结果的测试工具
    :return: 纯文本输出模式的 CLI 调用入口
    """

    def _run_text_cli_command(*args: str) -> subprocess.CompletedProcess[str]:
        """
        关闭颜色和图标后运行 CLI 命令。

        :param args: 传给被调用对象的位置参数
        :return: 关闭颜色和图标后的命令执行结果
        """
        return run_cli_command('--color=never', '--icon=none', *args)

    return _run_text_cli_command


@pytest.fixture
def run_cli_completion_command(
    backend_dir: Path,
) -> Callable[..., subprocess.CompletedProcess[str]]:
    """
    提供模拟 Shell 补全请求的运行入口。

    :param backend_dir: 后端项目目录
    :return: 模拟 Shell 补全请求的运行入口
    """

    def _run_cli_completion_command(
        *,
        comp_words: str,
        comp_cword: int | str,
        instruction: str = 'bash_complete',
    ) -> subprocess.CompletedProcess[str]:
        """
        执行补全请求并捕获候选项输出。

        :param comp_words: 当前补全请求的命令行词列表
        :param comp_cword: 光标所在词的位置
        :param instruction: 请求补全时传给 shell 的指令
        :return: 包含候选项或诊断的补全进程结果
        """
        return subprocess.run(
            [sys.executable, '-X', 'utf8', '-m', 'cli.main'],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            encoding='utf-8',
            check=False,
            timeout=CLI_PROCESS_TIMEOUT_SECONDS,
            env={
                **os.environ,
                'COMP_WORDS': comp_words,
                'COMP_CWORD': str(comp_cword),
                '_RUOYI_COMPLETE': instruction,
            },
        )

    return _run_cli_completion_command


@pytest.fixture
def untracked_bundle_project(tmp_path: Path) -> Path:
    """
    创建带未跟踪 SDK 的隔离 bundle 工程，供 CLI 检查与更新测试复用。

    :param tmp_path: pytest 临时目录
    :return: 不包含可执行业务插件的测试工程目录
    """
    root = tmp_path / 'example'
    vendor = root / 'web' / 'vendor'
    vendor.mkdir(parents=True)
    (root / 'plugin.yaml').write_text(
        'manifestVersion: 2\nid: example\nname: Example\nversion: 1.0.0\n'
        'backend:\n  module: plugins.example\n  entrypoint: plugins.example:create_plugin\n  integration: asgi\n'
        'frontend:\n  delivery:\n    type: bundle\n',
        encoding='utf-8',
    )
    (root / '__init__.py').write_text('raise RuntimeError("must never import this project")\n', encoding='utf-8')
    for name in ('pluginBridge.js', 'pluginBridge.d.ts'):
        (vendor / name).write_text('old untracked SDK\n', encoding='utf-8')
    return root


@pytest.fixture
def parse_json_stdout() -> Callable[[subprocess.CompletedProcess[str]], dict[str, Any]]:
    """
    提供从命令标准输出读取 JSON 的解析器。

    :return: 从命令标准输出读取 JSON 的解析器
    """

    def _parse_json_stdout(completed: subprocess.CompletedProcess[str]) -> dict[str, Any]:
        """
        从 CLI 标准输出中解析 JSON 结果。

        :param completed: 命令执行完成后的进程结果
        :return: 从命令标准输出解码的数据
        """
        return json.loads(completed.stdout)

    return _parse_json_stdout


@pytest.fixture
def assert_check_payload_contract() -> Callable[[dict[str, Any], bool], None]:
    """
    提供 CLI 检查结果的结构断言。

    :return: CLI 检查结果的结构断言
    """

    def _assert_check_payload_contract(payload: dict[str, Any], allow_exit_code: bool) -> None:
        """
        校验检查命令结果中的公共字段和类型。

        :param payload: 随调用传入或返回的结构化数据
        :param allow_exit_code: 契约允许的退出码
        """
        assert isinstance(payload, dict)
        assert isinstance(payload.get('ok'), bool)
        assert isinstance(payload.get('message'), str)

        if payload['ok']:
            if 'error' in payload:
                assert isinstance(payload['error'], str)
            if 'exit_code' in payload:
                assert isinstance(payload['exit_code'], int)
        else:
            assert isinstance(payload.get('error'), str)
            if allow_exit_code:
                assert isinstance(payload.get('exit_code'), int)

    return _assert_check_payload_contract
