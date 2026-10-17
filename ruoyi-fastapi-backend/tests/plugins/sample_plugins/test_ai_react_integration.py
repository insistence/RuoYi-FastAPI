import json
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from agno.run.agent import RunEvent

from cli.runtime.plugin.support import PluginDependencyLockfileTemplateBuilder
from plugins.ai.entity.vo.ai_chat_vo import AiChatRequestModel
from plugins.ai.service.ai_chat_service import AiChatService
from plugins.core.discovery.scanner import PluginScanner
from plugins.core.environment import PluginRuntimeEnvironmentService
from plugins.core.validation.dependencies import (
    NpmDependencyInspector,
    PluginDependencyChecker,
    PluginDependencyInstallPlanner,
    PythonDependencyInspector,
)

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from plugins.core.manifest.schema import PluginManifest

BACKEND_ROOT = Path(__file__).resolve().parents[3]
REACT_ROOT = BACKEND_ROOT.parent / 'ruoyi-fastapi-frontend' / 'react' / 'web'


def load_ai_manifest() -> 'PluginManifest':
    """加载实际 AI 插件清单，避免用测试清单掩盖发布遗漏。"""
    return (
        PluginScanner(BACKEND_ROOT / 'plugins').load_manifest(BACKEND_ROOT / 'plugins' / 'ai' / 'plugin.yaml').manifest
    )


def test_ai_react_dependencies_match_host_and_install_plan(tmp_path: Path) -> None:
    """校验实际清单、宿主依赖、安装目标和锁文件均选择 React 分类。"""
    manifest = load_ai_manifest()
    package = json.loads((REACT_ROOT / 'package.json').read_text(encoding='utf-8'))
    profile = manifest.dependencies.resolve_frontend('react')
    expected_packages = {'@ant-design/x', 'markstream-react', 'stream-diffs', 'katex', 'mermaid'}
    assert profile.npm_dev == []
    assert {
        item.name for item in NpmDependencyInspector(frontend_root=REACT_ROOT).check(profile.npm)
    } == expected_packages
    assert all(item.ok for item in NpmDependencyInspector(frontend_root=REACT_ROOT).check(profile.npm))
    assert expected_packages <= package['dependencies'].keys()

    root = tmp_path / 'ruoyi-fastapi-frontend' / 'react' / 'web'
    root.mkdir(parents=True)
    (root / 'package.json').write_text('{"dependencies":{"react":"19.2.0"}}', encoding='utf-8')
    environment = PluginRuntimeEnvironmentService(backend_root=BACKEND_ROOT, frontend_root=root)
    python_packages = dict(requirement.split('==') for requirement in manifest.dependencies.python)
    result = PluginDependencyChecker(
        python_inspector=PythonDependencyInspector(installed_packages=python_packages),
        npm_inspector=NpmDependencyInspector(frontend_root=root, installed_packages={}),
        runtime_environment=environment,
    ).check_manifest(manifest)
    plan = PluginDependencyInstallPlanner(frontend_root=root).build_plan(result)
    assert {item.name for item in plan.items} == expected_packages
    assert {item.workdir for item in plan.items} == {str(root)}
    assert all(item.kind == 'npm' for item in plan.items)
    assert any('markstream-react@2.0.17' in item.command for item in plan.items)
    lockfile = PluginDependencyLockfileTemplateBuilder.build(manifest, frontend_root=root).to_dict()
    assert lockfile['frontendFramework'] == 'react'
    assert {item['name'] for item in lockfile['npm']} == expected_packages
    assert lockfile['npmDev'] == []


@pytest.mark.asyncio
@pytest.mark.parametrize('reasoning_enabled', [False, True])
async def test_ai_stream_preserves_react_markdown_and_existing_vue_protocol(reasoning_enabled: bool) -> None:
    """真实流转换保持逐行 JSON 协议，完整传递正文、思考和 camelCase 指标。"""
    markdown = '你好，**Markdown**\n\n```python\nprint("你好")\n```\n\n$E=mc^2$'
    reasoning = '分析 **原有布局**'
    chunks = [
        SimpleNamespace(event=RunEvent.run_started, run_id='run-test'),
        SimpleNamespace(event=RunEvent.run_content, content=markdown[:12], reasoning_content=reasoning),
        SimpleNamespace(event=RunEvent.run_content, content=markdown[12:], reasoning_content=None),
        SimpleNamespace(event=RunEvent.run_completed, metrics=SimpleNamespace(to_dict=lambda: {'input_tokens': 3})),
    ]

    class FakeAgent:
        """离线流式 Agent，不请求模型或数据库。"""

        async def arun(self, message: str, **kwargs) -> 'AsyncIterator[SimpleNamespace]':
            """逐段返回测试模型事件。"""
            assert message == '你好'
            assert kwargs == {'stream': True, 'stream_events': True}
            for chunk in chunks:
                yield chunk

    request = AiChatRequestModel.model_validate(
        {'modelId': 1, 'sessionId': 'session-test', 'message': '你好', 'isReasoning': reasoning_enabled}
    )
    frames = [
        frame
        async for frame in AiChatService._stream_agent(
            FakeAgent(), request, {'stream': True, 'stream_events': True}, reasoning_enabled, 'session-test'
        )
    ]
    assert all(frame.endswith('\n') for frame in frames)
    events = [json.loads(frame) for frame in frames]
    assert events[0] == {'type': 'meta', 'session_id': 'session-test'}
    assert events[1] == {'type': 'run_info', 'run_id': 'run-test'}
    assert ''.join(event['content'] for event in events if event['type'] == 'content') == markdown
    assert ''.join(event['content'] for event in events if event['type'] == 'reasoning') == (
        reasoning if reasoning_enabled else ''
    )
    assert events[-1] == {'type': 'metrics', 'metrics': {'inputTokens': 3}}
