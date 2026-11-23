from collections.abc import Generator

import pytest

from tests.plugins.core.runtime.fakes import FakePluginService


@pytest.fixture(autouse=True)
def isolate_fake_plugin_service() -> Generator[None, None, None]:
    """
    在每个运行时测试前后重置共享 fake 状态。

    :yield: 上下文就绪后将控制权交给调用方
    """
    FakePluginService.reset()
    yield
    FakePluginService.reset()
