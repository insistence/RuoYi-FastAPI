from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from cli.tui.adapters.models import TUI_ADAPTER_MODEL_RENDERER, BrowserRecordSnapshot

ActionSlot = Literal['primary', 'secondary', 'global', 'utility']
ActionParameterBuilder = Callable[[BrowserRecordSnapshot | None, str], dict[str, object] | None]
ActionSummaryBuilder = Callable[[BrowserRecordSnapshot | None, str], list[str]]
ActionTextBuilder = Callable[[BrowserRecordSnapshot | None, str], str]


@dataclass(frozen=True)
class TuiActionSpec:
    """
    TUI 低风险动作定义。

    :ivar action_id: 动作唯一标识
    :ivar label: 动作显示名称
    :ivar parameters: 进程内运行时调用参数
    :ivar preview_title: 预览弹窗标题
    :ivar preview_lines: 预览摘要文本
    :ivar refresh_view: 执行完成后是否刷新当前页面
    """

    action_id: str
    label: str
    parameters: dict[str, object]
    preview_title: str
    preview_lines: list[str]
    refresh_view: bool = True


@dataclass(frozen=True)
class TuiActionResult:
    """
    TUI 动作执行结果。

    :ivar spec: 动作定义
    :ivar payload: CLI JSON 负载
    """

    spec: TuiActionSpec
    payload: dict[str, object] | None = None

    @property
    def ok(self) -> bool:
        """
        判断动作是否执行成功。

        :return: 是否成功
        """
        return bool(isinstance(self.payload, dict) and self.payload.get('ok', False))

    @property
    def message(self) -> str:
        """
        获取动作结果摘要。

        :return: 结果摘要
        """
        return TUI_ADAPTER_MODEL_RENDERER.extract_payload_message(self.payload)
