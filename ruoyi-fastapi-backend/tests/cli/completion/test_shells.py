import click.shell_completion as click_completion
import pytest
import typer

from cli.core.completion_dispatcher import CompletionDispatcher


@pytest.mark.parametrize(('comp_words', 'comp_cword'), [('ruoyi comp', 'comp'), ('ruoyi ', '')])
def test_powershell_completion_preserves_script_protocol_with_existing_registration(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], comp_words: str, comp_cword: str
) -> None:
    """已有同名补全类时，仍按项目脚本的文本参数和制表符输出协议补全。"""
    # Click 8.5 的内置 PowerShell 补全复用 Bash 的数字 COMP_CWORD 协议。
    monkeypatch.setitem(click_completion._available_shells, 'powershell', click_completion.BashComplete)
    monkeypatch.setenv('_RUOYI_COMPLETE', 'powershell_complete')
    monkeypatch.setenv('COMP_WORDS', comp_words)
    monkeypatch.setenv('COMP_CWORD', comp_cword)
    app = typer.Typer(add_completion=False, callback=lambda: None)

    @app.command()
    def completion() -> None:
        """管理命令补全。"""

    with pytest.raises(SystemExit) as result:
        CompletionDispatcher().dispatch(app)

    assert result.value.code == 0
    captured = capsys.readouterr()
    assert captured.err == ''
    assert any(line.split('\t', 2)[:2] == ['plain', 'completion'] for line in captured.out.splitlines())


@pytest.mark.parametrize(
    ('instruction', 'cursor', 'expected'),
    [
        ('bash_complete', '2', 'plain,show'),
        ('zsh_complete', '2', 'plain\nshow\n'),
        ('fish_complete', 'sh', 'plain,show'),
        ('powershell_complete', 'sh', 'plain\tshow\t'),
        ('complete_bash', '2', 'show'),
    ],
)
def test_nested_command_completion_uses_shell_protocol(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], instruction: str, cursor: str, expected: str
) -> None:
    """嵌套命令按各个 shell 的协议返回候选项。"""
    monkeypatch.setenv('_RUOYI_COMPLETE', instruction)
    monkeypatch.setenv('COMP_WORDS', 'ruoyi config sh')
    monkeypatch.setenv('COMP_CWORD', cursor)
    app = typer.Typer(add_completion=False)
    config = typer.Typer()
    app.add_typer(config, name='config')

    @config.command()
    def show() -> None:
        """显示配置。"""

    with pytest.raises(SystemExit) as result:
        CompletionDispatcher().dispatch(app)

    assert result.value.code == 0
    assert expected in capsys.readouterr().out
