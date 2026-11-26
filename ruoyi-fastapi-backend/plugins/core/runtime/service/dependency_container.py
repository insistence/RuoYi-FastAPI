from dataclasses import dataclass

from plugins.core.environment import PluginRuntimeEnvironmentService
from plugins.core.validation.dependencies import PluginDependencyChecker

from .gateway import (
    PluginAuditGateway,
    PluginCommandRunnerGateway,
    PluginConfigGateway,
    PluginLifecycleStateGateway,
    PluginLifecycleUnitOfWorkGateway,
    PluginManagementModelGateway,
    PluginMigrationExecutionGateway,
    PluginMigrationHistoryGateway,
    PluginPurgePlanGateway,
    PluginStateQueryGateway,
)


@dataclass
class PluginRuntimeGatewayOverrides:
    """
    插件运行时窄端口覆盖项。

    该对象用于测试或特殊组合根显式覆盖某个窄端口，避免 facade 构造器随着端口拆分持续膨胀。

    :ivar config_gateway: 读写插件配置的网关
    :ivar audit_gateway: 写入插件操作审计记录的网关
    :ivar state_query_gateway: 读取插件运行状态的网关
    :ivar migration_history_gateway: migration 历史查询端口
    :ivar purge_plan_gateway: 生成插件清理计划的网关
    :ivar lifecycle_state_gateway: 管理插件生命周期状态的网关
    :ivar lifecycle_uow_gateway: 创建生命周期事务工作单元的网关
    :ivar migration_execution_gateway: 执行插件数据库迁移的网关
    """

    config_gateway: PluginConfigGateway | None = None
    audit_gateway: PluginAuditGateway | None = None
    state_query_gateway: PluginStateQueryGateway | None = None
    migration_history_gateway: PluginMigrationHistoryGateway | None = None
    purge_plan_gateway: PluginPurgePlanGateway | None = None
    lifecycle_state_gateway: PluginLifecycleStateGateway | None = None
    lifecycle_uow_gateway: PluginLifecycleUnitOfWorkGateway | None = None
    migration_execution_gateway: PluginMigrationExecutionGateway | None = None


@dataclass
class PluginRuntimeDependencies:
    """
    插件运行时基础依赖集合。

    :ivar runtime_environment: 运行时环境服务
    :ivar dependency_checker: 插件依赖检查器
    :ivar config_gateway: 插件配置网关协议
    :ivar audit_gateway: 插件审计网关协议
    :ivar state_query_gateway: 插件状态查询网关协议
    :ivar migration_history_gateway: migration 历史查询端口
    :ivar purge_plan_gateway: 插件清理计划网关协议
    :ivar lifecycle_state_gateway: 插件生命周期状态写入网关协议
    :ivar lifecycle_uow_gateway: 插件生命周期主事务工作单元网关协议
    :ivar migration_execution_gateway: 插件 migration 独立执行网关协议
    :ivar model_gateway: 插件管理模型工厂网关
    :ivar command_gateway: 插件命令执行网关
    """

    runtime_environment: PluginRuntimeEnvironmentService
    dependency_checker: PluginDependencyChecker
    config_gateway: PluginConfigGateway
    audit_gateway: PluginAuditGateway
    state_query_gateway: PluginStateQueryGateway
    migration_history_gateway: PluginMigrationHistoryGateway
    purge_plan_gateway: PluginPurgePlanGateway
    lifecycle_state_gateway: PluginLifecycleStateGateway
    lifecycle_uow_gateway: PluginLifecycleUnitOfWorkGateway
    migration_execution_gateway: PluginMigrationExecutionGateway
    model_gateway: PluginManagementModelGateway
    command_gateway: PluginCommandRunnerGateway
