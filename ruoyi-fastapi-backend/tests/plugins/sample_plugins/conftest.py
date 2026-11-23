from collections.abc import Iterator
from pathlib import Path

import pytest

from i18n.catalogs import CatalogRegistry
from scripts.compile_i18n import compile_catalogs


@pytest.fixture
def ai_catalog() -> Iterator[None]:
    """
    为直接调用 AI 服务的测试加载与已启用插件相同的词库。

    :yield: 上下文就绪后将控制权交给调用方
    """
    compile_catalogs()
    CatalogRegistry.register_plugin('ai', Path(__file__).resolve().parents[3] / 'plugins/ai')
    try:
        yield
    finally:
        CatalogRegistry.unregister_plugin('ai')
