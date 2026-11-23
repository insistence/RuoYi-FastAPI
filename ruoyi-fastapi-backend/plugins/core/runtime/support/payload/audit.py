from collections.abc import Mapping
from typing import Protocol, TypeAlias, cast

from pydantic import Field

from i18n.message import I18nMessage

from .base import PluginPayloadModel


class PluginAuditItemPayload(PluginPayloadModel):
    """插件审计单项 payload。"""

    operation_id: object = Field(alias='operationId', description='操作记录标识')
    operation: object = Field(description='执行的操作类型')
    plugin_ids: list[object] = Field(alias='pluginIds', description='插件标识列表')
    dry_run: bool = Field(alias='dryRun', description='是否仅预演本次操作')
    continue_on_error: bool = Field(alias='continueOnError', description='遇到单项错误时是否继续处理')
    status: object = Field(description='当前状态')
    summary: object = Field(description='操作结果摘要')
    create_time: object = Field(alias='createTime', description='操作记录创建时间')
    remark: object = Field(description='补充说明')


class PluginAuditSnapshotPayload(PluginPayloadModel):
    """插件最近审计快照 payload。"""

    available: bool = Field(description='数据是否可用')
    count: int = Field(description='结果条数')
    items: list[Mapping[str, object]] = Field(description='结果条目列表')


class PluginAuditSnapshotFailurePayload(PluginPayloadModel):
    """插件最近审计快照读取失败 payload。"""

    available: bool = Field(description='数据是否可用')
    message: str = Field(description='面向调用方的结果说明')
    items: list[Mapping[str, object]] = Field(description='结果条目列表')


PluginAuditItemPayloadDict: TypeAlias = dict[str, object]
PluginAuditSnapshotPayloadDict: TypeAlias = dict[str, object]
PluginAuditSnapshotFailurePayloadDict: TypeAlias = dict[str, object]


class SupportsAuditModelDump(Protocol):
    """支持审计记录别名序列化的对象协议。"""

    def model_dump(self, *, by_alias: bool = False) -> Mapping[str, object]:
        """
        序列化审计记录。

        :param by_alias: 是否使用字段别名
        :return: 审计记录 payload
        """
        ...


class PluginAuditPayloadBuilder:
    """插件审计负载构建器。"""

    @staticmethod
    def build_recent_snapshot_failure(error: Exception) -> PluginAuditSnapshotFailurePayloadDict:
        """
        构建最近审计快照读取失败负载。

        :param error: 异常对象
        :return: 最近审计快照读取失败负载
        """
        return PluginAuditSnapshotFailurePayload(
            available=False,
            message=I18nMessage(
                f'最近审计快照读取失败：{error}',
                msg_key='plugin.runtime.audit.snapshotFailed',
                msg_params={},
            ),
            items=[],
        ).to_payload()

    @classmethod
    def build_recent_snapshot_payload(
        cls,
        plugin_id: str,
        operation_logs: list[object],
        *,
        audit_limit: int,
    ) -> PluginAuditSnapshotPayloadDict:
        """
        构建最近审计快照负载。

        :param plugin_id: 插件ID
        :param operation_logs: 审计记录列表
        :param audit_limit: 最近审计记录数量
        :return: 最近审计快照负载
        """
        recent_logs = [
            operation_log for operation_log in operation_logs if plugin_id in getattr(operation_log, 'plugin_ids', [])
        ][:audit_limit]
        return PluginAuditSnapshotPayload(
            available=True,
            count=len(recent_logs),
            items=[
                cast('SupportsAuditModelDump', operation_log).model_dump(by_alias=True)
                if hasattr(operation_log, 'model_dump')
                else cls.build_item_payload(operation_log)
                for operation_log in recent_logs
            ],
        ).to_payload()

    @staticmethod
    def build_item_payload(operation_log: object) -> PluginAuditItemPayloadDict:
        """
        构建审计记录负载。

        :param operation_log: 审计记录对象
        :return: 审计记录负载
        """
        return PluginAuditItemPayload(
            operation_id=getattr(operation_log, 'operation_id', None),
            operation=getattr(operation_log, 'operation', '-'),
            plugin_ids=list(cast('list[object]', getattr(operation_log, 'plugin_ids', []))),
            dry_run=bool(getattr(operation_log, 'dry_run', False)),
            continue_on_error=bool(getattr(operation_log, 'continue_on_error', False)),
            status=getattr(operation_log, 'status', '-'),
            summary=getattr(operation_log, 'summary', {}),
            create_time=getattr(operation_log, 'create_time', None),
            remark=getattr(operation_log, 'remark', None),
        ).to_payload()
