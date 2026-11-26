from typing import TypeAlias

from pydantic import Field

from plugins.core.runtime.support import (
    BatchOperationResultPayload,
    PluginAuditSnapshotFailurePayloadDict,
    PluginAuditSnapshotPayloadDict,
    PluginCheckPayloadDict,
    PluginConfigExportFailurePayloadDict,
    PluginConfigExportPayloadDict,
    PluginConfigImportPayloadDict,
    PluginConfigStatePayloadDict,
    PluginDependencyCheckPayloadDict,
    PluginDependencyInstallPayloadDict,
    PluginDocumentationPayloadDict,
    PluginEnableStatePayloadDict,
    PluginEnableUpdateFailurePayloadDict,
    PluginLifecyclePayloadDict,
    PluginNotFoundPayloadDict,
    PluginPurgeStatePayloadDict,
    PluginRuntimeBatchItemUnsupportedPayloadDict,
    PluginRuntimeDiagnoseFailurePayloadDict,
    PluginRuntimeDiagnosePayloadDict,
    PluginRuntimeExceptionPayloadDict,
    PluginRuntimeHealthResponsePayloadDict,
    PluginRuntimeInvalidOperationPayloadDict,
    PluginRuntimePrecheckPayloadDict,
    PluginRuntimeUpgradeBlockerPayloadDict,
    PluginSafeUninstallPayloadDict,
)
from plugins.core.runtime.support.payload.base import PluginPayloadModel


class PluginCatalogListResponsePayload(PluginPayloadModel):
    """插件列表响应 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    count: int = Field(description='结果条数')
    plugins: list[dict[str, object]] = Field(description='插件列表')
    database_available: bool | None = Field(default=None, alias='databaseAvailable', description='数据库是否可用')
    database_error: str | None = Field(default=None, alias='databaseError', description='数据库访问失败的原因')


class PluginCatalogInfoResponsePayload(PluginPayloadModel):
    """插件详情响应 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    plugin: dict[str, object] = Field(description='插件详情')


class PluginBatchRunResponsePayload(PluginPayloadModel):
    """插件批量执行响应 payload。"""

    ok: bool | None = Field(default=None, description='本次操作是否成功')
    message: str | None = Field(default=None, description='面向调用方的结果说明')
    dry_run: bool | None = Field(default=None, alias='dryRun', description='是否仅预演本次操作')
    continue_on_error: bool | None = Field(
        default=None, alias='continueOnError', description='遇到单项错误时是否继续处理'
    )
    executed: list[dict[str, object]] | None = Field(default=None, description='已执行的插件操作明细')
    failed: dict[str, object] | None = Field(default=None, description='导致批处理失败的操作明细')
    summary: dict[str, object] | None = Field(default=None, description='操作结果摘要')
    exit_code: int | None = Field(default=None, description='命令行退出码')


class PluginRuntimeBlockedPayload(PluginPayloadModel):
    """插件运行模式阻断响应 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    status: str = Field(description='当前状态')
    operation: str = Field(description='执行的操作类型')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    message: str = Field(description='面向调用方的结果说明')
    suggestion: str = Field(description='建议的后续处理方式')
    capability: dict[str, object] = Field(description='当前环境对该操作的支持情况')
    dry_run: bool | None = Field(default=None, alias='dryRun', description='是否仅预演本次操作')
    exit_code: int = Field(description='命令行退出码')


PluginCatalogListResponseDict: TypeAlias = dict[str, object]
PluginCatalogInfoResponseDict: TypeAlias = dict[str, object]
PluginBatchRunResponseDict: TypeAlias = dict[str, object]
PluginRuntimeBlockedPayloadDict: TypeAlias = dict[str, object]


PluginRuntimeBlockedResponse: TypeAlias = PluginRuntimeBlockedPayloadDict
PluginRuntimeFailureResponse: TypeAlias = (
    PluginNotFoundPayloadDict
    | PluginRuntimeExceptionPayloadDict
    | PluginRuntimeInvalidOperationPayloadDict
    | PluginRuntimeBlockedResponse
)
PluginCatalogListResponse: TypeAlias = PluginCatalogListResponseDict | PluginRuntimeExceptionPayloadDict
PluginCatalogInfoResponse: TypeAlias = PluginCatalogInfoResponseDict | PluginRuntimeFailureResponse
PluginCheckResponse: TypeAlias = PluginCheckPayloadDict | PluginRuntimeFailureResponse
PluginDependencyCheckResponse: TypeAlias = PluginDependencyCheckPayloadDict | PluginRuntimeFailureResponse
PluginHealthResponse: TypeAlias = PluginRuntimeHealthResponsePayloadDict | PluginRuntimeFailureResponse
PluginConfigStateResponse: TypeAlias = PluginConfigStatePayloadDict | PluginRuntimeFailureResponse
PluginConfigExportResponse: TypeAlias = PluginConfigExportPayloadDict | PluginConfigExportFailurePayloadDict
PluginConfigImportResponse: TypeAlias = PluginConfigImportPayloadDict
PluginPrecheckResponse: TypeAlias = PluginRuntimePrecheckPayloadDict | PluginRuntimeFailureResponse
PluginPlanResponse: TypeAlias = dict[str, object] | PluginRuntimeInvalidOperationPayloadDict
PluginBatchResponse: TypeAlias = PluginPlanResponse | PluginBatchRunResponseDict | PluginRuntimeExceptionPayloadDict
PluginBatchItemExecutionResponse: TypeAlias = (
    BatchOperationResultPayload
    | PluginLifecyclePayloadDict
    | PluginEnableStatePayloadDict
    | PluginRuntimeBatchItemUnsupportedPayloadDict
    | PluginRuntimeExceptionPayloadDict
)
PluginDependencyInstallResponse: TypeAlias = PluginDependencyInstallPayloadDict | PluginRuntimeFailureResponse
PluginLifecycleResponse: TypeAlias = (
    PluginLifecyclePayloadDict
    | PluginEnableStatePayloadDict
    | PluginEnableUpdateFailurePayloadDict
    | PluginSafeUninstallPayloadDict
    | PluginPurgeStatePayloadDict
    | PluginRuntimeUpgradeBlockerPayloadDict
    | PluginRuntimeFailureResponse
)
PluginDocumentationResponse: TypeAlias = (
    PluginDocumentationPayloadDict | PluginNotFoundPayloadDict | PluginRuntimeExceptionPayloadDict
)
PluginAuditSnapshotResponse: TypeAlias = PluginAuditSnapshotPayloadDict | PluginAuditSnapshotFailurePayloadDict
PluginDiagnoseResponse: TypeAlias = (
    PluginRuntimeDiagnosePayloadDict | PluginRuntimeDiagnoseFailurePayloadDict | PluginRuntimeExceptionPayloadDict
)
PluginManagementOperationResponse: TypeAlias = (
    PluginCheckResponse
    | PluginPrecheckResponse
    | PluginHealthResponse
    | PluginDiagnoseResponse
    | PluginDocumentationResponse
    | PluginLifecycleResponse
    | PluginConfigStateResponse
    | PluginConfigExportResponse
    | PluginConfigImportResponse
    | PluginDependencyCheckResponse
    | PluginPlanResponse
    | PluginBatchResponse
    | PluginDependencyInstallResponse
)
