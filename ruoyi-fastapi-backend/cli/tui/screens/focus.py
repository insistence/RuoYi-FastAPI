from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any, cast

from textual import on
from textual.containers import ScrollableContainer
from textual.screen import Screen

from cli.tui.widgets import NavigationItem, WorkspaceSidebar

if TYPE_CHECKING:
    from cli.tui.app import RuoyiTuiApp


class BaseScreenFocusService(ABC):
    """
    TUI 屏幕焦点服务基类。

    该基类统一处理焦点顺序中的左右移动和滚动目标回退逻辑，具体页面
    只需声明自身的焦点顺序和默认滚动容器。
    """

    @abstractmethod
    def get_focus_order(self, screen: Any) -> list[Any]:
        """
        返回当前页面的焦点顺序。

        :param screen: 当前屏幕对象
        :return: 焦点组件列表
        """

    @abstractmethod
    def get_default_scroll_target(self, screen: Any) -> ScrollableContainer:
        """
        返回当前页面的默认滚动容器。

        :param screen: 当前屏幕对象
        :return: 默认滚动容器
        """

    def move_focus(self, screen: Any, step: int) -> None:
        """
        按给定方向移动当前焦点。

        :param screen: 当前屏幕对象
        :param step: 焦点移动步长
        """
        order = self.get_focus_order(screen)
        focused = screen.app.focused
        if focused not in order:
            order[0].focus()
            return
        target_index = max(0, min(order.index(focused) + step, len(order) - 1))
        order[target_index].focus()

    def get_scroll_target(self, screen: Any) -> Any:
        """
        获取当前应响应滚动动作的焦点区域。

        :param screen: 当前屏幕对象
        :return: 当前焦点组件或默认滚动容器
        """
        focused = screen.app.focused
        order = self.get_focus_order(screen)
        if focused in order:
            return focused
        return self.get_default_scroll_target(screen)


class WorkspaceScreen(Screen[None]):
    """
    工作区屏幕的焦点与侧栏导航行为。

    :ivar active_view: 当前视图标识
    :ivar focus_service: TUI 屏幕焦点服务基类
    """

    active_view: str
    focus_service: BaseScreenFocusService

    @property
    def workspace_app(self) -> 'RuoyiTuiApp':
        """
        获取挂载当前工作区屏幕的应用。

        :return: 管理工作区导航的应用
        """
        return cast('RuoyiTuiApp', self.app)

    def _open_sidebar_item(self, event: WorkspaceSidebar.Highlighted | WorkspaceSidebar.Selected) -> None:
        """
        根据侧边栏事件打开对应视图，并避免重复打开当前页面。

        :param event: 侧边栏高亮或选中事件
        """
        item = getattr(event.item, 'item', None)
        if not isinstance(item, NavigationItem):
            return
        if not isinstance(event.control, WorkspaceSidebar) or not event.control.navigation_ready:
            return
        if item.view_key == self.active_view and self.workspace_app.requested_view == self.active_view:
            return
        self.workspace_app.open_view(item.view_key)

    @on(WorkspaceSidebar.Selected)
    def on_sidebar_selected(self, event: WorkspaceSidebar.Selected) -> None:
        """
        响应左侧导航选中事件并切换视图。

        :param event: 导航选中事件
        """
        self._open_sidebar_item(event)

    @on(WorkspaceSidebar.Highlighted)
    def on_sidebar_highlighted(self, event: WorkspaceSidebar.Highlighted) -> None:
        """
        响应左侧导航高亮变更并立即切换视图。

        :param event: 导航高亮事件
        """
        self._open_sidebar_item(event)

    def _get_scroll_target(self) -> Any:
        """
        获取当前应响应滚动动作的焦点区域。

        :return: 当前焦点组件或主工作区
        """
        return self.focus_service.get_scroll_target(self)

    def action_scroll_focus_down(self) -> None:
        """向下滚动当前焦点区域。"""
        self._get_scroll_target().scroll_down(animate=False)

    def action_scroll_focus_up(self) -> None:
        """向上滚动当前焦点区域。"""
        self._get_scroll_target().scroll_up(animate=False)

    def action_scroll_focus_page_down(self) -> None:
        """向下翻动当前焦点区域。"""
        self._get_scroll_target().scroll_page_down(animate=False)

    def action_scroll_focus_page_up(self) -> None:
        """向上翻动当前焦点区域。"""
        self._get_scroll_target().scroll_page_up(animate=False)

    def action_scroll_focus_home(self) -> None:
        """将当前焦点区域滚动到起始位置。"""
        self._get_scroll_target().scroll_home(animate=False)

    def action_scroll_focus_end(self) -> None:
        """将当前焦点区域滚动到末尾位置。"""
        self._get_scroll_target().scroll_end(animate=False)

    def action_focus_left(self) -> None:
        """将焦点向左移动一列。"""
        self.focus_service.move_focus(self, -1)

    def action_focus_right(self) -> None:
        """将焦点向右移动一列。"""
        self.focus_service.move_focus(self, 1)
