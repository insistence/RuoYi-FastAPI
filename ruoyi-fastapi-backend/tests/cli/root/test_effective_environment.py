import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import typer
from typer.testing import CliRunner

from cli.context import EnvOption

BACKEND_DIR = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize(
    ('external_env', 'selected', 'file_env', 'expected_selector', 'expected_app', 'rejected'),
    [
        (None, None, 'dev', 'dev', 'dev', False),
        ('prod', None, 'dev', 'prod', 'prod', True),
        (None, 'prod', 'prod', 'prod', 'prod', True),
        (None, 'dockermy', 'prod', 'dockermy', 'prod', True),
        (None, 'dockerpg', 'prod', 'dockerpg', 'prod', True),
        ('prod', 'dev', 'dev', 'dev', 'prod', True),
        ('dev', 'prod', 'prod', 'prod', 'dev', True),
    ],
)
def test_guard_uses_loaded_environment_without_resource_access(
    tmp_path: Path,
    external_env: str | None,
    selected: str | None,
    file_env: str,
    expected_selector: str,
    expected_app: str,
    rejected: bool,
) -> None:
    (tmp_path / f'.env.{expected_selector}').write_text(f'APP_ENV={file_env}\n', encoding='utf-8')
    script = """
import json
from cli.context import CLI_CONTEXT_BUILDER
from cli.guards import DEFAULT_DANGEROUS_COMMAND_GUARD, DEFAULT_DANGEROUS_COMMAND_RULE_REGISTRY
ctx = CLI_CONTEXT_BUILDER.build('dev', 'json', False, True, False)
rule = DEFAULT_DANGEROUS_COMMAND_RULE_REGISTRY.require_rule('job run-once')
result = DEFAULT_DANGEROUS_COMMAND_GUARD.guard(ctx, rule=rule)
ctx.allow_prod = True
allowed = DEFAULT_DANGEROUS_COMMAND_GUARD.guard(ctx, rule=rule)
print(json.dumps({'env': ctx.env, 'appEnv': ctx.app_env, 'rejected': result is not None, 'allowed': allowed is None}))
"""
    process_env = {key: value for key, value in os.environ.items() if key != 'APP_ENV' and not key.startswith('OIDC_')}
    process_env['PYTHONPATH'] = str(BACKEND_DIR)
    process_env['DB_DEFAULT_SOURCE'] = 'master'
    process_env['DB_SOURCES'] = json.dumps(
        {
            'master': {
                'db_type': 'mysql',
                'db_host': '127.0.0.1',
                'db_port': 1,
                'db_username': 'test',
                'db_password': 'test',
                'db_database': 'isolated',
            }
        }
    )
    if external_env:
        process_env['APP_ENV'] = external_env
    completed = subprocess.run(
        [sys.executable, '-c', script, *(['--env', selected] if selected else [])],
        cwd=tmp_path,
        env=process_env,
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )
    assert completed.returncode == 0, completed.stderr
    assert json.loads(completed.stdout) == {
        'env': expected_selector,
        'appEnv': expected_app,
        'rejected': rejected,
        'allowed': True,
    }


def test_env_option_uses_external_default_and_preserves_explicit_choice(monkeypatch: pytest.MonkeyPatch) -> None:
    app = typer.Typer()
    selected = []

    @app.command()
    def run(env: EnvOption = 'dev') -> None:
        selected.append(env)

    monkeypatch.setenv('APP_ENV', 'prod')
    runner = CliRunner()
    assert runner.invoke(app, []).exit_code == 0
    assert runner.invoke(app, ['--env', 'dockermy']).exit_code == 0
    assert selected == ['prod', 'dockermy']
