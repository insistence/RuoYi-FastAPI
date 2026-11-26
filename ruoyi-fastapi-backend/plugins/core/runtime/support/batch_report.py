from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from time import perf_counter
from typing import TypeAlias

from pydantic import Field

from i18n.message import I18nMessage
from plugins.core.runtime.support.payload.base import PluginPayloadModel
from plugins.core.validation.plugin_deps import PluginBatchOperation


class BatchOperationResult(PluginPayloadModel):
    """批量单项运行时结果 payload。"""

    ok: bool | None = Field(default=None, description='本次操作是否成功')
    message: str | None = Field(default=None, description='面向调用方的结果说明')
    plugin_dependency_errors: object | None = Field(
        default=None, alias='pluginDependencyErrors', description='插件之间的依赖检查错误'
    )
    structure_errors: object | None = Field(
        default=None, alias='structureErrors', description='插件目录或文件结构检查错误'
    )
    menu_conflicts: object | None = Field(default=None, alias='menuConflicts', description='检测到的菜单冲突')
    error: object | None = Field(default=None, description='失败原因')


class BatchSummary(PluginPayloadModel):
    """批量执行汇总 payload。"""

    total: int = Field(description='条目总数')
    succeeded: int = Field(description='成功的操作数')
    failed: int = Field(description='失败的操作数')
    skipped: int = Field(description='跳过的条目数')


@dataclass(frozen=True)
class PluginBatchItemReport:
    """
    插件批量执行单项报告。

    :ivar plugin_id: 插件ID
    :ivar operation: 批量操作类型
    :ivar ok: 是否执行成功
    :ivar status: 执行状态
    :ivar message: 执行消息
    :ivar duration_ms: 耗时毫秒数
    :ivar suggestion: 失败建议
    """

    plugin_id: str
    operation: PluginBatchOperation
    ok: bool
    status: str
    message: str
    duration_ms: int
    suggestion: str


class BatchFailedItem(PluginPayloadModel):
    """批量失败项 payload。"""

    plugin_id: str = Field(alias='pluginId', description='插件标识')
    operation: str | None = Field(default=None, description='执行的操作类型')
    ok: bool | None = Field(default=None, description='本次操作是否成功')
    status: str | None = Field(default=None, description='当前状态')
    message: str | None = Field(default=None, description='面向调用方的结果说明')
    duration_ms: int | None = Field(default=None, alias='durationMs', description='本次操作耗时（毫秒）')
    suggestion: str | None = Field(default=None, description='建议的后续处理方式')
    result: dict[str, object] = Field(description='单项操作的详细结果')


class PluginBatchRunPayload(PluginPayloadModel):
    """插件批量执行响应 payload。"""

    ok: bool | None = Field(default=None, description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    operation: str | None = Field(default=None, description='执行的操作类型')
    database_available: bool | None = Field(default=None, alias='databaseAvailable', description='数据库是否可用')
    database_error: str | None = Field(default=None, alias='databaseError', description='数据库访问失败的原因')
    plan: dict[str, object] | None = Field(default=None, description='预定执行的操作计划')
    dry_run: bool = Field(alias='dryRun', description='是否仅预演本次操作')
    continue_on_error: bool = Field(alias='continueOnError', description='遇到单项错误时是否继续处理')
    executed: list[dict[str, object]] = Field(description='已执行的插件操作明细')
    failed: dict[str, object] | None = Field(description='导致批处理失败的操作明细')
    summary: dict[str, object] = Field(description='操作结果摘要')


BatchOperationResultPayload: TypeAlias = dict[str, object]
BatchSummaryPayload: TypeAlias = dict[str, object]
BatchItemReportPayload: TypeAlias = dict[str, object]
BatchFailedPayload: TypeAlias = dict[str, object]
BatchPlanPayload: TypeAlias = Mapping[str, object]
BatchItemRunner: TypeAlias = Callable[[PluginBatchOperation, str], Awaitable[BatchOperationResultPayload]]


class PluginBatchReportBuilder:
    """
    插件批量执行报告构建器。

    使用 Builder 模式统一生成批量执行单项报告和汇总信息。
    """

    @classmethod
    async def run_item(
        cls,
        operation: PluginBatchOperation,
        plugin_id: str,
        runner: BatchItemRunner,
    ) -> tuple[PluginBatchItemReport, BatchOperationResultPayload]:
        """
        执行单个插件批量操作并构建报告。

        :param operation: 批量操作类型
        :param plugin_id: 插件ID
        :param runner: 异步执行函数
        :return: 单项报告和原始执行结果
        """
        started_at = perf_counter()
        result = await runner(operation, plugin_id)
        duration_ms = int((perf_counter() - started_at) * 1000)
        report = cls.build_item_report(operation, plugin_id, result, duration_ms)

        return report, result

    @classmethod
    def build_item_report(
        cls,
        operation: PluginBatchOperation,
        plugin_id: str,
        result: BatchOperationResultPayload,
        duration_ms: int,
    ) -> PluginBatchItemReport:
        """
        构建单个插件批量操作报告。

        :param operation: 批量操作类型
        :param plugin_id: 插件ID
        :param result: 原始执行结果
        :param duration_ms: 耗时毫秒数
        :return: 单项报告
        """
        ok = bool(result.get('ok', False))
        message = result.get('message', '-')

        return PluginBatchItemReport(
            plugin_id=plugin_id,
            operation=operation,
            ok=ok,
            status='success' if ok else 'failed',
            message=message if isinstance(message, str) else str(message),
            duration_ms=duration_ms,
            suggestion='' if ok else cls.build_failure_suggestion(operation, plugin_id, result),
        )

    @staticmethod
    def build_summary(reports: list[PluginBatchItemReport], total: int) -> BatchSummaryPayload:
        """
        构建插件批量执行汇总。

        :param reports: 单项报告列表
        :param total: 计划执行总数
        :return: 汇总负载
        """
        failed = len([report for report in reports if not report.ok])
        succeeded = len([report for report in reports if report.ok])

        return BatchSummary(
            total=total,
            succeeded=succeeded,
            failed=failed,
            skipped=max(total - succeeded - failed, 0),
        ).to_payload()

    @staticmethod
    def resolve_executable_plugin_ids(plan_payload: BatchPlanPayload) -> list[str]:
        """
        从批量计划负载中解析实际执行插件 ID。

        计划会展示目标插件的依赖闭包，但执行阶段只执行用户显式请求的插件，避免依赖插件状态影响
        用户本次选择的插件安装或升级。

        :param plan_payload: 插件批量计划负载
        :return: 实际执行插件 ID 列表
        """
        plan = plan_payload.get('plan', {})
        if not isinstance(plan, Mapping):
            return []
        requested_plugin_ids = plan.get('requestedPluginIds')
        ordered_plugin_ids = plan.get('orderedPluginIds')
        if not isinstance(ordered_plugin_ids, list):
            ordered_plugin_ids = requested_plugin_ids
        if not isinstance(ordered_plugin_ids, list):
            return []
        requested = set(requested_plugin_ids) if isinstance(requested_plugin_ids, list) else set()
        return [
            plugin_id
            for plugin_id in ordered_plugin_ids
            if isinstance(plugin_id, str) and (not requested or plugin_id in requested)
        ]

    @classmethod
    def build_plan_blocked_payload(
        cls,
        plan_payload: BatchPlanPayload,
        *,
        dry_run: bool,
        continue_on_error: bool,
    ) -> dict[str, object]:
        """
        构建插件批量计划阻断负载。

        :param plan_payload: 插件批量计划负载
        :param dry_run: 是否预演
        :param continue_on_error: 失败后是否继续执行后续插件
        :return: 插件批量计划阻断负载
        """
        total = cls._count_planned_items(plan_payload)
        return PluginBatchRunPayload.model_validate(
            {
                **plan_payload,
                'dryRun': dry_run,
                'continueOnError': continue_on_error,
                'executed': [],
                'failed': None,
                'summary': cls.build_summary([], total),
                'message': I18nMessage(
                    '插件批量操作计划存在阻塞项，未执行任何写操作', msg_key='plugin.runtime.batch.blocked'
                ),
            }
        ).to_payload()

    @classmethod
    def build_dry_run_payload(
        cls,
        plan_payload: BatchPlanPayload,
        *,
        continue_on_error: bool,
    ) -> dict[str, object]:
        """
        构建插件批量执行预演负载。

        :param plan_payload: 插件批量计划负载
        :param continue_on_error: 失败后是否继续执行后续插件
        :return: 插件批量执行预演负载
        """
        total = cls._count_planned_items(plan_payload)
        return PluginBatchRunPayload.model_validate(
            {
                **plan_payload,
                'message': I18nMessage(
                    '插件批量操作演练完成，未执行实际写入', msg_key='plugin.runtime.batch.previewCompleted'
                ),
                'dryRun': True,
                'continueOnError': continue_on_error,
                'executed': [],
                'failed': None,
                'summary': cls.build_summary([], total),
            }
        ).to_payload()

    @classmethod
    def build_failed_payload(
        cls,
        report: PluginBatchItemReport,
        result: BatchOperationResultPayload,
    ) -> BatchFailedPayload:
        """
        构建插件批量执行失败项负载。

        :param report: 单项报告
        :param result: 单项原始执行结果
        :return: 失败项负载
        """
        return BatchFailedItem.model_validate({**cls.dump_item_report(report), 'result': result}).to_payload(
            exclude_none=True
        )

    @classmethod
    def build_execution_payload(
        cls,
        plan_payload: BatchPlanPayload,
        reports: list[PluginBatchItemReport],
        failed: BatchFailedPayload | None,
        *,
        continue_on_error: bool,
    ) -> dict[str, object]:
        """
        构建插件批量执行结果负载。

        :param plan_payload: 插件批量计划负载
        :param reports: 单项执行报告列表
        :param failed: 首个失败项负载
        :param continue_on_error: 失败后是否继续执行后续插件
        :return: 插件批量执行结果负载
        """
        ok = failed is None
        return PluginBatchRunPayload.model_validate(
            {
                **plan_payload,
                'ok': ok,
                'message': cls.build_batch_message(ok, continue_on_error),
                'dryRun': False,
                'continueOnError': continue_on_error,
                'executed': [cls.dump_item_report(report) for report in reports],
                'failed': failed,
                'summary': cls.build_summary(reports, cls._count_planned_items(plan_payload)),
            }
        ).to_payload()

    @staticmethod
    def build_batch_message(ok: bool, continue_on_error: bool) -> str:
        """
        构建批量执行结果消息。

        :param ok: 批量执行是否全部成功
        :param continue_on_error: 失败后是否继续执行后续插件
        :return: 批量执行结果消息
        """
        if ok:
            return I18nMessage('插件批量操作完成', msg_key='plugin.runtime.batch.completed')
        if continue_on_error:
            return I18nMessage('插件批量操作完成，存在失败项', msg_key='plugin.runtime.batch.partial')

        return I18nMessage('插件批量操作中止', msg_key='plugin.runtime.batch.stopped')

    @staticmethod
    def dump_item_report(report: PluginBatchItemReport) -> BatchItemReportPayload:
        """
        转换单项报告为插件运行时负载。

        :param report: 单项报告
        :return: 单项报告负载
        """
        return {
            'pluginId': report.plugin_id,
            'operation': report.operation,
            'ok': report.ok,
            'status': report.status,
            'message': report.message,
            'durationMs': report.duration_ms,
            'suggestion': report.suggestion,
        }

    @staticmethod
    def build_failure_suggestion(
        operation: PluginBatchOperation,
        plugin_id: str,
        result: BatchOperationResultPayload,
    ) -> str:
        """
        构建插件批量执行失败建议。

        :param operation: 批量操作类型
        :param plugin_id: 插件ID
        :param result: 原始执行结果
        :return: 失败建议
        """
        if result.get('pluginDependencyErrors'):
            return I18nMessage(
                f'先执行 ruoyi plugin plan {operation} {plugin_id} 查看插件依赖阻塞项',
                msg_key='plugin.suggestion.batchDependencies',
                msg_params={'operation': operation, 'plugin_id': plugin_id},
            )
        if result.get('structureErrors'):
            return I18nMessage(
                f'先执行 ruoyi plugin check {plugin_id} 修复插件目录结构问题',
                msg_key='plugin.suggestion.batchStructure',
                msg_params={'plugin_id': plugin_id},
            )
        if result.get('menuConflicts'):
            return I18nMessage(
                f'先执行 ruoyi plugin check {plugin_id} 查看菜单或权限冲突',
                msg_key='plugin.suggestion.batchMenus',
                msg_params={'plugin_id': plugin_id},
            )
        if result.get('error'):
            return I18nMessage('查看错误详情并修复后重新执行批量命令', msg_key='plugin.suggestion.batchError')

        return I18nMessage(
            f'先单独执行 ruoyi plugin {operation} {plugin_id} --dry-run 定位失败原因',
            msg_key='plugin.suggestion.batchDryRun',
            msg_params={'operation': operation, 'plugin_id': plugin_id},
        )

    @staticmethod
    def _count_planned_items(plan_payload: BatchPlanPayload) -> int:
        """
        统计插件批量计划项数量。

        :param plan_payload: 插件批量计划负载
        :return: 计划项数量
        """
        plan = plan_payload.get('plan', {})
        if not isinstance(plan, Mapping):
            return 0
        requested_plugin_ids = plan.get('requestedPluginIds')
        if isinstance(requested_plugin_ids, list) and requested_plugin_ids:
            return len(requested_plugin_ids)

        ordered_plugin_ids = plan.get('orderedPluginIds')
        return len(ordered_plugin_ids) if isinstance(ordered_plugin_ids, list) else 0
