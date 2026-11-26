from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from plugins.core.validation.dependency_policy import DependencyInstallPolicyMode

PluginFrontendFrameworkChoice = Literal['auto', 'vue2', 'vue3', 'react']
PluginPlanOperation = Literal['install', 'enable', 'upgrade']
PluginPrecheckOperation = Literal[PluginPlanOperation, 'uninstall', 'purge']


@dataclass(frozen=True)
class PluginCreateCommandOptions:
    """
    插件创建命令选项。

    :ivar backend_only: 是否只创建后端插件模板
    :ivar frontend_only: 是否只创建前端插件模板
    :ivar template: 插件模板名称
    :ivar frontend_framework: 前端框架标识，auto 表示自动识别；源码模板支持 vue2、vue3、react
    :ivar no_migration: 是否不创建 migration 示例
    :ivar no_seed: 是否不创建 seed 示例
    :ivar no_job: 是否不创建定时任务示例
    :ivar no_config: 是否不创建配置项示例
    :ivar no_test: 是否不创建测试样例
    :ivar dry_run: 是否仅预演
    """

    backend_only: bool = False
    frontend_only: bool = False
    template: str = 'full-stack'
    frontend_framework: PluginFrontendFrameworkChoice = 'auto'
    no_migration: bool = False
    no_seed: bool = False
    no_job: bool = False
    no_config: bool = False
    no_test: bool = False
    dry_run: bool = False


@dataclass(frozen=True)
class PluginDependencyInstallCommandOptions:
    """
    插件依赖安装命令选项。

    :ivar allow_prod: 是否允许生产环境危险命令
    :ivar yes: 是否跳过确认
    :ivar dry_run: 是否仅预演
    :ivar policy_mode: 临时覆盖策略模式
    :ivar allow_unlisted: 是否允许未命中 allowlist 的依赖仅告警
    :ivar lockfile: 锁文件路径
    :ivar allowlist: 依赖允许列表路径
    :ivar offline_dir: 离线制品目录
    :ivar require_lockfile: 是否要求锁文件
    """

    allow_prod: bool = False
    yes: bool = False
    dry_run: bool = False
    policy_mode: 'DependencyInstallPolicyMode | None' = None
    allow_unlisted: bool = False
    lockfile: str = ''
    allowlist: str = ''
    offline_dir: str = ''
    require_lockfile: bool | None = None


@dataclass(frozen=True)
class PluginDependencyLockCommandOptions:
    """
    插件依赖锁文件模板命令选项。

    :ivar output_path: 输出锁文件路径
    :ivar offline_dir: 离线制品目录
    :ivar dry_run: 是否仅预演
    :ivar overwrite: 是否覆盖已有锁文件
    """

    output_path: str = ''
    offline_dir: str = ''
    dry_run: bool = False
    overwrite: bool = False


@dataclass(frozen=True)
class PluginDependencyAllowlistExampleCommandOptions:
    """
    插件依赖允许列表示例命令选项。

    :ivar output_path: 输出允许列表路径
    :ivar dry_run: 是否仅预演
    :ivar overwrite: 是否覆盖已有文件
    """

    output_path: str = ''
    dry_run: bool = False
    overwrite: bool = False
