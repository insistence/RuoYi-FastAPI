from collections.abc import Mapping
from typing import TypeAlias, cast

from pydantic import Field

from i18n.message import I18nMessage
from plugins.core.types import PluginConfigValue, SupportsModelDump

from .base import PluginPayloadModel


class PluginConfigStatePayload(PluginPayloadModel):
    """插件配置读取/更新 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    configs: list[dict[str, object]] = Field(description='插件配置项列表')
    operation: str | None = Field(default=None, description='执行的操作类型')


class PluginConfigExportFailurePayload(PluginPayloadModel):
    """插件配置导出失败 payload。"""

    ok: object = Field(description='本次操作是否成功')
    message: object = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    reveal_secret: bool = Field(alias='revealSecret', description='是否显示敏感配置的原值')
    values: dict[str, object] = Field(description='按配置键索引的值')
    metadata: list[dict[str, object]] = Field(description='导出配置的元数据')


class PluginConfigExportPayload(PluginPayloadModel):
    """插件配置导出 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    message: str = Field(description='面向调用方的结果说明')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    reveal_secret: bool = Field(alias='revealSecret', description='是否显示敏感配置的原值')
    configs: list[dict[str, object]] = Field(description='插件配置项列表')
    values: dict[str, object] = Field(description='按配置键索引的值')
    metadata: list[dict[str, object]] = Field(description='导出配置的元数据')


class PluginConfigDiagnosticSummaryPayload(PluginPayloadModel):
    """插件配置诊断摘要 payload。"""

    total: int = Field(description='条目总数')
    secret_count: int = Field(alias='secretCount', description='敏感配置项数')
    required_count: int = Field(alias='requiredCount', description='必填配置项数')
    configured_count: int = Field(alias='configuredCount', description='已设置值的配置项数')
    missing_required_count: int = Field(alias='missingRequiredCount', description='尚未填写的必填配置项数')
    missing_required_keys: list[str] = Field(alias='missingRequiredKeys', description='尚未填写的必填配置键')
    masked: bool = Field(description='敏感值是否已遮盖')


class PluginConfigImportPayload(PluginPayloadModel):
    """插件配置导入 payload。"""

    ok: object | None = Field(default=None, description='本次操作是否成功')
    message: object | None = Field(default=None, description='面向调用方的结果说明')
    plugin_id: object | None = Field(default=None, alias='pluginId', description='插件标识')
    operation: str | None = Field(default=None, description='执行的操作类型')
    configs: list[dict[str, object]] | None = Field(default=None, description='插件配置项列表')
    imported_keys: list[str] = Field(alias='importedKeys', description='本次导入的配置键')


class PluginConfigAuditChangePayload(PluginPayloadModel):
    """插件配置审计变更项 payload。"""

    key: str = Field(description='配置项的键')
    label: object = Field(description='面向用户的显示名称')
    secret: bool = Field(description='是否包含敏感值')
    before: object = Field(description='变更前的配置值')
    after: object = Field(description='变更后的配置值')


class PluginConfigAuditSummaryPayload(PluginPayloadModel):
    """插件配置审计摘要 payload。"""

    changed_count: int = Field(alias='changedCount', description='已变更的配置项数')
    changed_keys: list[str] = Field(alias='changedKeys', description='本次变更的配置键')
    changes: list[dict[str, object]] = Field(description='逐项记录的配置变更')


class PluginConfigAuditPayload(PluginPayloadModel):
    """插件配置审计 payload。"""

    ok: bool = Field(description='本次操作是否成功')
    operation: str = Field(description='执行的操作类型')
    plugin_id: str = Field(alias='pluginId', description='插件标识')
    message: str = Field(description='面向调用方的结果说明')
    summary: dict[str, object] = Field(description='操作结果摘要')


PluginConfigStatePayloadDict: TypeAlias = dict[str, object]
PluginConfigExportFailurePayloadDict: TypeAlias = dict[str, object]
PluginConfigExportPayloadDict: TypeAlias = dict[str, object]
PluginConfigDiagnosticSummaryPayloadDict: TypeAlias = dict[str, object]
PluginConfigImportPayloadDict: TypeAlias = dict[str, object]
PluginConfigAuditPayloadDict: TypeAlias = dict[str, object]


class PluginConfigPayloadBuilder:
    """
    插件配置负载构建器。

    使用 Builder 模式集中处理配置诊断摘要、配置导出和配置变更审计负载。
    """

    @classmethod
    def build_read_payload(cls, plugin_id: str, configs: list[SupportsModelDump]) -> PluginConfigStatePayloadDict:
        """
        构建插件配置读取负载。

        :param plugin_id: 插件ID
        :param configs: 插件配置模型列表
        :return: 插件配置读取负载
        """
        return cls._build_state_payload(
            plugin_id=plugin_id,
            message=I18nMessage('插件配置读取完成', msg_key='plugin.runtime.config.loaded'),
            configs=configs,
        )

    @staticmethod
    def build_export_failure_payload(
        plugin_id: str,
        payload: Mapping[str, object],
        *,
        reveal_secret: bool,
    ) -> PluginConfigExportFailurePayloadDict:
        """
        构建插件配置导出失败负载。

        :param plugin_id: 插件ID
        :param payload: 配置读取失败负载
        :param reveal_secret: 是否导出敏感配置明文
        :return: 插件配置导出失败负载
        """
        export_payload = dict(payload)
        export_payload.update(
            {
                'pluginId': plugin_id,
                'revealSecret': reveal_secret,
                'values': {},
                'metadata': [],
            }
        )
        return PluginConfigExportFailurePayload.model_validate(export_payload).to_payload()

    @staticmethod
    def build_diagnostic_summary(configs: object) -> PluginConfigDiagnosticSummaryPayloadDict:
        """
        构建插件配置诊断摘要。

        :param configs: 插件配置明细列表
        :return: 配置诊断摘要
        """
        config_items = [config for config in configs if isinstance(config, dict)] if isinstance(configs, list) else []
        secret_count = sum(1 for config in config_items if bool(config.get('secret')))
        required_count = sum(1 for config in config_items if bool(config.get('required')))
        missing_required_keys = [
            str(config.get('key', '-'))
            for config in config_items
            if bool(config.get('required')) and not config.get('value')
        ]
        configured_count = sum(
            1
            for config in config_items
            if config.get('value') not in (None, '') and str(config.get('value')) != '******'
        )

        return PluginConfigDiagnosticSummaryPayload(
            total=len(config_items),
            secret_count=secret_count,
            required_count=required_count,
            configured_count=configured_count,
            missing_required_count=len(missing_required_keys),
            missing_required_keys=missing_required_keys,
            masked=secret_count > 0,
        ).to_payload()

    @classmethod
    def build_export_payload(
        cls,
        plugin_id: str,
        configs: list[object],
        *,
        reveal_secret: bool = False,
    ) -> PluginConfigExportPayloadDict:
        """
        构建插件配置导出负载。

        :param plugin_id: 插件ID
        :param configs: 插件配置列表
        :param reveal_secret: 是否导出敏感配置明文
        :return: 插件配置导出负载
        """
        config_items = [cast('dict[str, object]', config) for config in configs if isinstance(config, dict)]
        return PluginConfigExportPayload(
            ok=True,
            message=I18nMessage('插件配置导出完成', msg_key='plugin.runtime.config.exported'),
            plugin_id=plugin_id,
            reveal_secret=reveal_secret,
            configs=config_items,
            values={
                config.get('key'): cast('PluginConfigValue', config.get('value'))
                for config in config_items
                if isinstance(config.get('key'), str)
            },
            metadata=[cls._build_export_metadata(config) for config in config_items],
        ).to_payload()

    @classmethod
    def build_update_payload(
        cls,
        plugin_id: str,
        *,
        operation: str,
        message: str,
        configs: list[SupportsModelDump],
    ) -> PluginConfigStatePayloadDict:
        """
        构建插件配置更新负载。

        :param plugin_id: 插件ID
        :param operation: 配置操作类型
        :param message: 成功提示
        :param configs: 更新后的配置模型列表
        :return: 插件配置更新负载
        """
        return cls._build_state_payload(
            plugin_id=plugin_id,
            message=message,
            configs=configs,
            operation=operation,
        )

    @staticmethod
    def build_import_payload(
        plugin_id: str,
        payload: Mapping[str, object],
        values: dict[str, PluginConfigValue],
    ) -> PluginConfigImportPayloadDict:
        """
        构建插件配置导入负载。

        :param plugin_id: 插件ID
        :param payload: 配置更新负载
        :param values: 待导入配置键值
        :return: 插件配置导入负载
        """
        if payload.get('ok', False):
            import_payload = dict(payload)
            import_payload['importedKeys'] = sorted(values)
            return PluginConfigImportPayload.model_validate(import_payload).to_payload(exclude_none=True)

        import_payload = dict(payload)
        import_payload.setdefault('pluginId', plugin_id)
        import_payload['importedKeys'] = []
        return PluginConfigImportPayload.model_validate(import_payload).to_payload(exclude_none=True)

    @classmethod
    def build_audit_payload(
        cls,
        plugin_id: str,
        *,
        operation: str,
        values: dict[str, PluginConfigValue],
        before_configs: list[SupportsModelDump],
        after_configs: list[SupportsModelDump],
        message: str,
    ) -> PluginConfigAuditPayloadDict:
        """
        构建插件配置变更审计负载。

        :param plugin_id: 插件ID
        :param operation: 配置操作类型
        :param values: 本次请求更新的配置键值
        :param before_configs: 更新前配置列表
        :param after_configs: 更新后配置列表
        :param message: 审计备注信息
        :return: 插件配置变更审计负载
        """
        before_map = cls._build_audit_map(before_configs)
        after_map = cls._build_audit_map(after_configs)
        changed_keys = sorted(str(key) for key in values)
        changed_items = [
            cls._build_audit_item(key, before_map.get(key, {}), after_map.get(key, {})) for key in changed_keys
        ]

        return PluginConfigAuditPayload(
            ok=True,
            operation=operation,
            plugin_id=plugin_id,
            message=message,
            summary=PluginConfigAuditSummaryPayload(
                changed_count=len(changed_items),
                changed_keys=changed_keys,
                changes=changed_items,
            ).to_payload(),
        ).to_payload()

    @staticmethod
    def _build_state_payload(
        *,
        plugin_id: str,
        message: str,
        configs: list[SupportsModelDump],
        operation: str | None = None,
    ) -> PluginConfigStatePayloadDict:
        """
        构建插件配置读取/更新状态负载。

        :param plugin_id: 插件ID
        :param message: 响应消息
        :param configs: 插件配置模型列表
        :param operation: 配置操作类型
        :return: 插件配置读取/更新状态负载
        """
        return PluginConfigStatePayload(
            ok=True,
            message=message,
            plugin_id=plugin_id,
            configs=[cast('dict[str, object]', config.model_dump(by_alias=True)) for config in configs],
            operation=operation,
        ).to_payload(exclude_none=True)

    @staticmethod
    def _build_export_metadata(config: Mapping[str, object]) -> dict[str, object]:
        """
        构建不包含配置值的导出元数据。

        :param config: 配置项
        :return: 配置导出元数据
        """
        return {
            key: config.get(key)
            for key in (
                'key',
                'label',
                'type',
                'default',
                'required',
                'secret',
                'group',
                'order',
                'placeholder',
                'min',
                'max',
                'pattern',
                'options',
                'description',
            )
        }

    @staticmethod
    def _build_audit_map(configs: list[SupportsModelDump]) -> dict[str, dict[str, PluginConfigValue]]:
        """
        构建按配置键索引的审计配置映射。

        :param configs: 插件配置模型列表
        :return: 按配置键索引的配置审计映射
        """
        config_map: dict[str, dict[str, PluginConfigValue]] = {}
        for config in configs:
            payload = config.model_dump(by_alias=True) if hasattr(config, 'model_dump') else {}
            if not isinstance(payload, dict) or not isinstance(payload.get('key'), str):
                continue
            config_map[payload['key']] = cast('dict[str, PluginConfigValue]', payload)

        return config_map

    @classmethod
    def _build_audit_item(
        cls,
        key: str,
        before_config: dict[str, PluginConfigValue],
        after_config: dict[str, PluginConfigValue],
    ) -> PluginConfigAuditChangePayload:
        """
        构建单个配置项的脱敏变更摘要。

        :param key: 配置键
        :param before_config: 变更前配置负载
        :param after_config: 变更后配置负载
        :return: 单个配置项脱敏变更摘要
        """
        secret = bool(before_config.get('secret') or after_config.get('secret'))

        return PluginConfigAuditChangePayload(
            key=key,
            label=after_config.get('label') or before_config.get('label'),
            secret=secret,
            before=cls._mask_audit_value(before_config.get('value'), secret),
            after=cls._mask_audit_value(after_config.get('value'), secret),
        ).to_payload()

    @staticmethod
    def _mask_audit_value(value: PluginConfigValue, secret: bool) -> PluginConfigValue:
        """
        对配置审计值执行敏感信息脱敏。

        :param value: 配置值
        :param secret: 是否敏感配置
        :return: 脱敏后的配置值
        """
        return '******' if secret and value is not None else value
