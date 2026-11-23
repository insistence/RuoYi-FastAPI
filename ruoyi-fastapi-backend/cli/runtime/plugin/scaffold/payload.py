from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cli.exit_codes import RUNTIME_ERROR
from cli.utils import format_cli_path


@dataclass(frozen=True)
class PluginScaffoldPlanPayload:
    """
    插件模板写入计划负载。

    :ivar template: 用于生成文件的模板
    :ivar backend: 后端部分的配置或处理对象
    :ivar frontend: 前端部分的配置
    :ivar migration: 插件的数据迁移配置
    :ivar seed: 插件的种子数据配置
    :ivar job: 插件的调度任务配置
    :ivar config: 当前对象使用的配置
    :ivar crud: 是否生成增删改查功能
    :ivar test: 是否生成测试
    :ivar backend_test: 是否包含后端测试
    :ivar frontend_test: 是否包含前端测试
    :ivar frontend_framework: 用于生成或构建前端的框架
    :ivar target_dirs: 生成操作要写入的目录
    :ivar files: 此次操作涉及的文件
    :ivar conflicts: 生成计划与已有文件的冲突
    """

    template: str
    backend: bool
    frontend: bool
    migration: bool
    seed: bool
    job: bool
    config: bool
    crud: bool
    test: bool
    backend_test: bool
    frontend_test: bool
    frontend_framework: str | None
    target_dirs: list[str]
    files: list[tuple[Path, str]]
    conflicts: list[str]

    def to_payload(self) -> dict[str, Any]:
        """
        序列化为既有 CLI payload 契约。

        :return: 插件模板写入计划负载
        """
        return {
            'backend': self.backend,
            'frontend': self.frontend,
            'template': self.template,
            'migration': self.migration,
            'seed': self.seed,
            'job': self.job,
            'config': self.config,
            'crud': self.crud,
            'test': self.test,
            'backendTest': self.backend_test,
            'frontendTest': self.frontend_test,
            'frontendFramework': self.frontend_framework,
            'targetDirs': [format_cli_path(path) for path in self.target_dirs],
            'files': [{'path': path.as_posix(), 'content': content} for path, content in self.files],
            'conflicts': self.conflicts,
        }


@dataclass(frozen=True)
class PluginScaffoldSuccessPayload:
    """
    插件模板创建成功负载。

    :ivar plugin_id: 插件清单中的唯一标识
    :ivar scaffold_plan: 插件模板写入计划
    :ivar dry_run: 是否只预览操作结果
    """

    plugin_id: str
    scaffold_plan: dict[str, Any]
    dry_run: bool

    def to_payload(self) -> dict[str, Any]:
        """
        序列化为既有 CLI payload 契约。

        :return: 插件模板创建成功负载
        """
        return {
            'ok': True,
            'message': '插件模板预演完成' if self.dry_run else '插件模板创建成功',
            'pluginId': self.plugin_id,
            'dryRun': self.dry_run,
            **self.scaffold_plan,
        }


@dataclass(frozen=True)
class PluginScaffoldConflictPayload:
    """
    插件模板目录冲突负载。

    :ivar plugin_id: 插件清单中的唯一标识
    :ivar scaffold_plan: 插件模板写入计划
    :ivar dry_run: 是否只预览操作结果
    :ivar failure_code: 失败退出码
    """

    plugin_id: str
    scaffold_plan: dict[str, Any]
    dry_run: bool
    failure_code: int = RUNTIME_ERROR

    def to_payload(self) -> dict[str, Any]:
        """
        序列化为既有 CLI payload 契约。

        :return: 插件模板目录冲突负载
        """
        return {
            'ok': False,
            'message': '插件目录已存在，拒绝覆盖',
            'pluginId': self.plugin_id,
            'dryRun': self.dry_run,
            **self.scaffold_plan,
            'exit_code': self.failure_code,
        }


class PluginScaffoldPayloadBuilder:
    """插件模板创建响应负载构建器。"""

    @staticmethod
    def build_conflict_payload(
        plugin_id: str,
        scaffold_plan: dict[str, Any],
        *,
        dry_run: bool,
        failure_code: int = RUNTIME_ERROR,
    ) -> dict[str, Any]:
        """
        构建插件模板目录冲突负载。

        :param plugin_id: 插件ID
        :param scaffold_plan: 插件模板写入计划
        :param dry_run: 是否预演
        :param failure_code: 失败退出码
        :return: 插件模板目录冲突负载
        """
        return PluginScaffoldConflictPayload(
            plugin_id,
            scaffold_plan,
            dry_run=dry_run,
            failure_code=failure_code,
        ).to_payload()

    @staticmethod
    def build_success_payload(plugin_id: str, scaffold_plan: dict[str, Any], *, dry_run: bool) -> dict[str, Any]:
        """
        构建插件模板创建成功负载。

        :param plugin_id: 插件ID
        :param scaffold_plan: 插件模板写入计划
        :param dry_run: 是否预演
        :return: 插件模板创建成功负载
        """
        return PluginScaffoldSuccessPayload(plugin_id, scaffold_plan, dry_run=dry_run).to_payload()
