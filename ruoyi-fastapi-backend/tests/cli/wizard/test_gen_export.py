from types import ModuleType, SimpleNamespace
from unittest.mock import Mock

from pytest import MonkeyPatch


def test_gen_export_wizard_executes_nested_cli_with_selected_tables(
    monkeypatch: MonkeyPatch,
    gen_export_flow: ModuleType,
) -> None:
    """导出向导将选中的表传给嵌套命令。"""
    complete_payload = Mock()
    answers = iter(['dev', 'sys_user,sys_role', 'zip', 'build/demo.zip', True, True])
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow,
        'prompt_service',
        SimpleNamespace(
            prompt_env=lambda default_env='dev': next(answers),
            prompt_required_text=lambda prompt_text, default_value='': next(answers),
            prompt_choice=lambda prompt_text, choices, default_value: next(answers),
            prompt_optional_text=lambda prompt_text, default_value='': next(answers),
            prompt_confirm=lambda prompt_text, default_value=False: next(answers),
        ),
    )
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow.context_factory,
        'build_regular',
        lambda env, output, allow_prod, yes, dry_run: SimpleNamespace(
            env=env,
            output=output,
            allow_prod=allow_prod,
            yes=yes,
            dry_run=dry_run,
        ),
    )
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow,
        'nested_command_runner',
        lambda *arguments, parse_json=False: SimpleNamespace(
            returncode=0,
            payload={
                'ok': True,
                'message': '代码导出演练完成，未执行实际导出',
                'dryRun': True,
                'mode': 'zip',
                'tableNames': ['sys_user', 'sys_role'],
                'outputFile': '/tmp/demo.zip',
            },
        ),
    )
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow.execution_service,
        'complete_payload',
        complete_payload,
    )

    gen_export_flow.run_gen_export_wizard('json')

    complete_payload.assert_called_once()
    ctx, payload = complete_payload.call_args.args
    assert ctx.env == 'dev'
    assert ctx.output == 'json'
    assert ctx.dry_run is True
    assert payload['tableNames'] == ['sys_user', 'sys_role']
    assert payload['mode'] == 'zip'


def test_gen_export_wizard_accepts_default_context_values(
    monkeypatch: MonkeyPatch,
    gen_export_flow: ModuleType,
) -> None:
    """导出向导接受上下文默认值。"""
    captured_defaults: dict[str, object] = {}
    captured_confirm_defaults: list[tuple[str, bool]] = []
    answers = iter(['dev', 'sys_user', 'zip', 'build/demo.zip', True, False])
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow,
        'prompt_service',
        SimpleNamespace(
            prompt_env=lambda default_env='dev': captured_defaults.update({'env': default_env}) or next(answers),
            prompt_required_text=lambda prompt_text, default_value='': (
                captured_defaults.update({'table_names': default_value}) or next(answers)
            ),
            prompt_choice=lambda prompt_text, choices, default_value: (
                captured_defaults.update({'mode': default_value}) or next(answers)
            ),
            prompt_optional_text=lambda prompt_text, default_value='': (
                captured_defaults.update({'output_file': default_value}) or next(answers)
            ),
            prompt_confirm=lambda prompt_text, default_value=False: (
                captured_confirm_defaults.append((prompt_text, default_value)) or next(answers)
            ),
        ),
    )
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow.context_factory,
        'build_regular',
        lambda env, output, allow_prod, yes, dry_run: SimpleNamespace(env=env, output=output),
    )
    monkeypatch.setattr(
        gen_export_flow.GenExportWizardFlow.execution_service,
        'complete_result',
        lambda ctx, result: None,
    )

    gen_export_flow.run_gen_export_wizard(
        'text',
        default_env='dev',
        default_table_names='sys_user',
        default_mode='zip',
        default_output_file='build/demo.zip',
        default_dry_run=True,
    )

    assert captured_defaults['env'] == 'dev'
    assert captured_defaults['table_names'] == 'sys_user'
    assert captured_defaults['mode'] == 'zip'
    assert captured_defaults['output_file'] == 'build/demo.zip'
    assert captured_confirm_defaults[0][1] is True
