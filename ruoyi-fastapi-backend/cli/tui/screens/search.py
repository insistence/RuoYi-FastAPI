from textual import on
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
from textual.screen import ModalScreen
from textual.widgets import Input, Static

from cli.tui.copy import TUI_COPY


class SearchInputScreen(ModalScreen[str | None]):
    """
    通用搜索输入弹窗。

    :cvar CSS: 终端界面使用的样式规则
    :cvar BINDINGS: 终端界面的快捷键和对应动作
    :ivar _title: 输入框的标题
    :ivar _placeholder: 输入框为空时的提示
    :ivar _value: 输入框的当前内容
    :ivar _suggestions: 可供选择的搜索建议
    :param title: 弹窗标题
    :param placeholder: 输入框提示
    :param value: 当前搜索词
    :param suggestions: 候选建议
    """

    CSS = """
    SearchInputScreen {
        align: center middle;
    }

    #search-dialog {
        width: 88;
        max-width: 88;
        border: heavy #38d8ff;
        background: #06111b;
        padding: 1 2;
    }

    #search-title {
        text-style: bold;
        color: #e9fcff;
        margin-bottom: 1;
    }

    #search-input {
        margin-bottom: 1;
    }

    #search-suggestions {
        color: #8fc6d6;
    }
    """

    BINDINGS = [
        Binding('escape', 'cancel', TUI_COPY.build_confirm_binding_label('cancel'), show=False),
        Binding('enter', 'submit', TUI_COPY.build_confirm_binding_label('submit'), show=False),
    ]

    def __init__(self, title: str, placeholder: str, value: str, suggestions: list[str]) -> None:
        """
        设置搜索初始值、提示文字和候选项。

        :param title: 弹窗标题
        :param placeholder: 输入框提示
        :param value: 当前搜索词
        :param suggestions: 候选建议
        """
        super().__init__()
        self._title = title
        self._placeholder = placeholder
        self._value = value
        self._suggestions = suggestions

    def compose(self) -> ComposeResult:
        """
        构建搜索输入框及操作控件。

        :yield: 按显示顺序排列的界面组件
        """
        with Vertical(id='search-dialog'):
            yield Static(self._title, id='search-title', markup=False)
            yield Input(value=self._value, placeholder=self._placeholder, id='search-input')
            suggestion_text = '候选建议 · ' + ('  '.join(self._suggestions[:6]) if self._suggestions else '暂无建议')
            yield Static(suggestion_text, id='search-suggestions', markup=False)

    def on_mount(self) -> None:
        """将焦点移到搜索输入框。"""
        self.call_after_refresh(self.query_one('#search-input', Input).focus)

    def action_cancel(self) -> None:
        """取消搜索并关闭输入对话框。"""
        self.dismiss(None)

    def action_submit(self) -> None:
        """提交当前输入的搜索条件。"""
        input_widget = self.query_one('#search-input', Input)
        self.dismiss(str(input_widget.value or '').strip())

    @on(Input.Submitted, '#search-input')
    def on_input_submitted(self) -> None:
        """在输入框确认时提交搜索。"""
        self.action_submit()
