from contextlib import AbstractAsyncContextManager
from pathlib import Path
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from plugins.core.discovery.scanner import DiscoveredPlugin
from plugins.core.runtime.support import PluginPrecheckContext

from ..context import PluginRuntimeContextService
from ..gateway import PluginLifecycleUnitOfWork
from ..responses import PluginLifecycleResponse, PluginRuntimeBlockedPayloadDict

_T = TypeVar('_T')


def require_step_result(value: _T | None, step: str) -> _T:
    """
    读取前置生命周期步骤已经产生的结果。

    :param value: 上下文中保存的步骤结果
    :param step: 应当产生该结果的步骤名
    :return: 前置步骤产生的值
    :raises RuntimeError: 前置步骤尚未提供所需结果
    """
    if value is None:
        raise RuntimeError(f'缺少插件生命周期步骤 {step} 的结果')
    return value


class PluginDiscoveryContext:
    """
    为依赖插件发现和预检的步骤提供已完成的结果。

    :ivar discovered_plugin: 发现步骤匹配的插件
    :ivar precheck: 插件预检结果
    :ivar session_context: 负责打开和关闭会话的上下文
    :ivar session: 当前步骤共享的数据库会话
    """

    __slots__ = ('discovered_plugin', 'precheck', 'session', 'session_context')
    discovered_plugin: DiscoveredPlugin | None
    precheck: PluginPrecheckContext | None
    session_context: AbstractAsyncContextManager[PluginLifecycleUnitOfWork] | None
    session: AsyncSession | None

    @property
    def resolved_plugin(self) -> DiscoveredPlugin:
        """
        获取发现步骤匹配的插件。

        :return: 已发现的目标插件
        """
        return require_step_result(self.discovered_plugin, 'discover_plugin')

    @property
    def precheck_result(self) -> PluginPrecheckContext:
        """
        获取预检步骤生成的结果。

        :return: 插件预检结果
        """
        return require_step_result(self.precheck, 'build_precheck')


class PluginTransactionContext(PluginDiscoveryContext):
    """
    为需要主事务的生命周期步骤提供工作单元。

    :ivar lifecycle_uow: 打开会话步骤创建的事务工作单元
    """

    __slots__ = ('lifecycle_uow',)
    lifecycle_uow: PluginLifecycleUnitOfWork | None

    @property
    def active_transaction(self) -> PluginLifecycleUnitOfWork:
        """
        获取本次操作使用的事务工作单元。

        :return: 已打开的事务工作单元
        """
        return require_step_result(self.lifecycle_uow, '打开主事务')


class PluginLifecycleUseCaseSupport:
    """
    生命周期 use case 公共协作能力。

    :ivar context: 生命周期上下文
    """

    context: PluginRuntimeContextService

    def _discover_plugins(self, backend_root: Path) -> list[DiscoveredPlugin]:
        """
        发现本地插件。

        :param backend_root: 后端项目根目录
        :return: 已发现插件列表
        """
        return self.context.discover_plugins(backend_root)

    def _get_discovered_plugin(self, plugin_id: str) -> DiscoveredPlugin | None:
        """
        根据插件 ID 获取已发现插件。

        :param plugin_id: 插件ID
        :return: 已发现插件对象
        """
        return self.context.get_discovered_plugin(plugin_id)

    def _get_discovered_plugin_from_list(
        self,
        discovered_plugins: list[DiscoveredPlugin],
        plugin_id: str,
    ) -> DiscoveredPlugin | None:
        """
        从已发现插件列表中查找指定插件。

        :param discovered_plugins: 已发现插件列表
        :param plugin_id: 插件ID
        :return: 已发现插件对象
        """
        return self.context.get_discovered_plugin_from_list(discovered_plugins, plugin_id)

    def _build_operation_blocked_payload(
        self,
        discovered_plugin: DiscoveredPlugin,
        operation: str,
        *,
        dry_run: bool | None = None,
    ) -> PluginRuntimeBlockedPayloadDict | None:
        """
        构建运行模式阻断负载。

        :param discovered_plugin: 已发现插件
        :param operation: 操作类型
        :param dry_run: 是否预演
        :return: 阻断负载，不阻断时返回 None
        """
        return self.context.build_operation_blocked_payload(discovered_plugin, operation, dry_run=dry_run)

    async def _build_precheck_context(
        self,
        backend_root: Path,
        discovered_plugin: DiscoveredPlugin,
        discovered_plugins: list[DiscoveredPlugin],
    ) -> PluginPrecheckContext:
        """
        构建插件操作预检上下文。

        :param backend_root: 后端项目根目录
        :param discovered_plugin: 当前插件
        :param discovered_plugins: 已发现插件列表
        :return: 插件操作预检上下文
        """
        return await self.context.build_precheck_context(backend_root, discovered_plugin, discovered_plugins)

    def _with_plugin_capability(
        self,
        payload: PluginLifecycleResponse,
        discovered_plugin: DiscoveredPlugin | None,
    ) -> PluginLifecycleResponse:
        """
        为运行时响应负载附加插件操作能力。

        :param payload: 运行时响应负载
        :param discovered_plugin: 已发现插件
        :return: 附加能力后的响应负载
        """
        return self.context.with_plugin_capability(payload, discovered_plugin)

    async def _close_lifecycle_session(self, context: PluginDiscoveryContext) -> None:
        """
        关闭生命周期上下文中的数据库会话。

        :param context: 生命周期上下文
        """
        session_context = context.session_context
        if session_context is None:
            return
        try:
            await session_context.__aexit__(None, None, None)
        finally:
            context.session_context = None
            context.session = None
            if isinstance(context, PluginTransactionContext):
                context.lifecycle_uow = None
