from pathlib import Path
from unittest.mock import patch

import typer
from click.shell_completion import ShellComplete

from cli.completion.installers import (
    CompletionInstallerService,
    CompletionInstallerShellSupport,
    CompletionShellRuntimePolicy,
    CompletionShellRuntimePolicyRegistry,
)


def test_build_source_command_uses_shell_runtime_policy() -> None:
    """校验安装服务会按 shell 运行时策略构建 source 命令。"""
    installer = CompletionInstallerService()
    target_file = Path('/tmp/ruoyi-completion')

    assert installer.build_source_command(target_file, 'bash') == 'source /tmp/ruoyi-completion'
    assert installer.build_source_command(target_file, 'zsh') == 'source /tmp/ruoyi-completion'
    assert (
        installer.build_source_command(target_file, 'fish')
        == 'status --is-interactive; and source /tmp/ruoyi-completion'
    )
    assert installer.build_source_command(target_file, 'powershell') == '. "/tmp/ruoyi-completion"'


def test_make_bash_completion_script_compatible_wraps_legacy_instructions() -> None:
    """校验 Bash 兼容转换会包装旧版 shell 不支持的指令。"""
    script_text = 'compopt -o dirnames\ncompopt -o default\ncomplete -o nosort -F _ruoyi_completion ruoyi'

    compatible_script = CompletionInstallerShellSupport.make_bash_completion_script_compatible(script_text)

    assert 'if command -v compopt >/dev/null 2>&1; then' in compatible_script
    assert 'complete -F _ruoyi_completion ruoyi' in compatible_script
    assert 'complete -o nosort -F _ruoyi_completion ruoyi 2>/dev/null' in compatible_script


def test_render_completion_script_uses_runtime_policy_transformer() -> None:
    """校验脚本渲染会通过 shell 运行时策略执行脚本后处理。"""

    class DummyComplete(ShellComplete):
        """模拟 Click completion 生成器。"""

        def source(self) -> str:
            """
            返回原始脚本文本。

            :return: 原始脚本文本
            """
            return 'raw-script'

    runtime_policy_registry = CompletionShellRuntimePolicyRegistry(
        policies={
            'bash': CompletionShellRuntimePolicy(
                name='bash',
                click_completion_class=DummyComplete,
                script_transformer=lambda script_text: f'transformed::{script_text}',
                source_command_builder=lambda target_file: f'source {target_file}',
            )
        }
    )
    installer = CompletionInstallerService(shell_runtime_policy_registry=runtime_policy_registry)
    root_cli = typer.Typer(callback=lambda: None)

    rendered_script = installer.render_completion_script(root_cli, 'bash')

    assert rendered_script == 'transformed::raw-script'


def test_render_powershell_completion_script_contains_native_completer() -> None:
    """校验 PowerShell completion 脚本会注册原生命令补全器。"""
    installer = CompletionInstallerService()
    root_cli = typer.Typer()

    @root_cli.command()
    def demo() -> None:
        """完成无需返回值的回调。"""
        return

    rendered_script = installer.render_completion_script(root_cli, 'powershell')

    assert 'Register-ArgumentCompleter -Native -CommandName ruoyi' in rendered_script
    assert '$env:_RUOYI_COMPLETE = "powershell_complete"' in rendered_script


def test_render_bash_script_does_not_execute_the_host_shell() -> None:
    """渲染 Bash 脚本时不执行宿主命令。"""
    root_cli = typer.Typer()

    @root_cli.command()
    def demo() -> None:
        """完成无需返回值的回调。"""
        return

    with patch('click.shell_completion.BashComplete._check_version', side_effect=AssertionError('host shell invoked')):
        rendered = CompletionInstallerService().render_completion_script(root_cli, 'bash')
    assert '_ruoyi_completion()' in rendered
    assert 'command -v compopt' in rendered
