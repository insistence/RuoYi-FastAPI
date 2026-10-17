import {
  canInstall,
  canUpgrade,
  canUninstall,
  isOrphanPlugin,
  canExecuteActionResult,
  isOperationBlocked,
  isCapabilityOperationBlocked,
} from "@/utils/pluginCapabilities";
export {
  canInstall,
  canUpgrade,
  canUninstall,
  isOrphanPlugin,
  canExecuteActionResult,
  isOperationBlocked,
  isCapabilityOperationBlocked,
};
import { parseTime } from "@/utils/ruoyi";
import { getPlanOperationLabel, normalizePluginActionResult } from "@/utils/pluginPlanFormatter";
const INVALID_PLUGIN_TIME_VALUES = new Set(["", "-", "0", "0-0-0 0:0:0", "0000-00-00 00:00:00"]);
export function formatPluginTime(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string" && INVALID_PLUGIN_TIME_VALUES.has(value.trim())) {
    return "-";
  }

  const formatted = parseTime(value);
  if (!formatted || INVALID_PLUGIN_TIME_VALUES.has(String(formatted).trim())) {
    return "-";
  }

  return formatted;
}

export const pluginStatusOptions = [
  { label: "已发现", value: "discovered", tagType: "info" },
  { label: "已安装", value: "installed", tagType: "success" },
  { label: "待升级", value: "pending_upgrade", tagType: "warning" },
  { label: "异常", value: "error", tagType: "danger" },
];

export const operationLogStatusOptions = [
  { label: "成功", value: "success", tagType: "success" },
  { label: "失败", value: "failed", tagType: "danger" },
  { label: "阻塞", value: "blocked", tagType: "warning" },
  { label: "预演", value: "dry_run", tagType: "info" },
];

export function getStatusLabel(status) {
  const option = pluginStatusOptions.find((item) => item.value === status);
  return option ? option.label : status || "-";
}

export function getStatusTagType(status) {
  const option = pluginStatusOptions.find((item) => item.value === status);
  return option ? option.tagType : "info";
}

export function getCapabilityReason(capability) {
  return capability?.primaryReason || capability?.warnings?.[0] || "当前环境不允许执行该插件操作";
}

export function getDependencyPolicyReason(policy) {
  const messages = [
    ...(Array.isArray(policy?.reasons) ? policy.reasons : []),
    ...(Array.isArray(policy?.requirements) ? policy.requirements : []),
  ];
  return messages[0] || "当前依赖安装策略不允许执行真实安装";
}

export function getOperationTooltip(row, operation, label) {
  return isOperationBlocked(row, operation) ? getCapabilityReason(row.capability) : label;
}

export function getDependencyTagType(row) {
  if (row.status === "skipped") {
    return "info";
  }
  return row.ok ? "success" : "danger";
}

export function formatDependencyInstalled(row) {
  if (row.status === "skipped") {
    return "不适用";
  }
  return row.installed ? "是" : "否";
}

export function formatDependencyVersionSatisfied(row) {
  if (row.status === "skipped") {
    return "不适用";
  }
  return row.versionSatisfied ? "是" : "否";
}

export function normalizeActionResult(result) {
  return normalizePluginActionResult(result);
}

export function buildErrorActionResult(error, context = {}) {
  const message = getErrorMessage(error);
  const payload = error?.response?.data?.data || {};
  const migrationRecovery = payload.migrationRecovery;
  return {
    ok: false,
    pluginId: payload.pluginId || context.pluginId,
    operation: payload.operation || context.operation,
    dependencyOk: false,
    structureOk: undefined,
    menuConflictOk: undefined,
    failedStep: payload.failedStep,
    migrationRecovery,
    error: {
      message: payload.error || message,
      suggestion:
        migrationRecovery?.suggestion ||
        "请先执行插件检查，确认目录结构、依赖和菜单权限冲突后再重试。",
      raw: serializeError(error),
    },
    message,
  };
}

export function buildErrorBatchResult(error, operation, executablePluginIds = []) {
  const message = getErrorMessage(error);

  return {
    ok: false,
    operation,
    message,
    summary: {
      total: executablePluginIds.length,
      succeeded: 0,
      failed: 1,
      skipped: Math.max(executablePluginIds.length - 1, 0),
    },
    executed: [
      {
        pluginId: executablePluginIds[0] || "-",
        operation,
        ok: false,
        status: "failed",
        message,
        suggestion: "请查看审计详情或后端日志后重试。",
      },
    ],
  };
}

export function getErrorMessage(error) {
  if (!error) {
    return "插件操作失败";
  }
  if (typeof error === "string") {
    return error;
  }
  return error.message || error.msg || error.response?.data?.msg || "插件操作失败";
}

export function serializeError(error) {
  if (!error) {
    return {};
  }
  if (typeof error === "string") {
    return { message: error };
  }
  return {
    message: error.message,
    name: error.name,
    status: error.response?.status,
    data: error.response?.data,
  };
}

export function isUserCancel(error) {
  return error === "cancel" || error === "close" || error?.message === "cancel";
}

export function formatBoolean(value) {
  if (value === undefined || value === null) {
    return "-";
  }
  return value ? "通过" : "异常";
}

export function formatPlanDependencies(dependencies) {
  return Array.isArray(dependencies) && dependencies.length ? dependencies.join(", ") : "-";
}

export function formatPluginIdsForDisplay(pluginIds) {
  const ids = Array.isArray(pluginIds) ? pluginIds.filter(Boolean) : [];
  if (!ids.length) {
    return "-";
  }
  const visibleIds = ids.slice(0, 8).join(", ");
  return ids.length > 8 ? visibleIds + " 等 " + ids.length + " 个插件" : visibleIds;
}

export function formatConfigDefaultValue(item) {
  const value = item.default;
  if (item.secret && value !== undefined && value !== null && value !== "") {
    return "******";
  }
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatConfigConstraint(item) {
  const constraints = [];
  if (item.min !== undefined && item.min !== null) {
    constraints.push("最小值 " + item.min);
  }
  if (item.max !== undefined && item.max !== null) {
    constraints.push("最大值 " + item.max);
  }
  if (item.pattern) {
    constraints.push("正则 " + item.pattern);
  }
  if (Array.isArray(item.options) && item.options.length) {
    constraints.push("选项 " + item.options.map(formatConfigOption).join(", "));
  }
  return constraints.length ? constraints.join("; ") : "-";
}

export function formatConfigOption(option) {
  if (!option || typeof option !== "object") {
    return String(option);
  }
  const value = option.value === undefined || option.value === null ? "" : String(option.value);
  return option.label ? option.label + "(" + value + ")" : value;
}

export function formatPluginOperation(operation, dictionary = []) {
  return getPlanOperationLabel(operation, dictionary);
}

export function getOperationLogStatusLabel(status) {
  const option = operationLogStatusOptions.find((item) => item.value === status);

  return option ? option.label : status || "-";
}

export function getOperationLogStatusTagType(status) {
  const option = operationLogStatusOptions.find((item) => item.value === status);

  return option ? option.tagType : "info";
}

export function formatRetentionMessage(result) {
  const actionText = result.dryRun ? "预览" : "清理";
  const cutoffTime = formatPluginTime(result.cutoffTime);
  return (
    actionText +
    "完成：保留 " +
    result.retentionDays +
    " 天，截止 " +
    cutoffTime +
    "，匹配 " +
    result.matchedCount +
    " 条，已删除 " +
    result.deletedCount +
    " 条"
  );
}

export function formatActionPlanState(action) {
  if (action.ok === true) {
    return "通过";
  }
  if (action.ok === false) {
    return "异常";
  }
  if (action.hook) {
    return action.hook;
  }
  if (action.targetEnabled !== undefined) {
    return action.targetEnabled ? "目标启用" : "目标停用";
  }
  if (action.targetStatus !== undefined) {
    return action.targetStatus === "0" ? "目标正常" : "目标停用";
  }
  return "-";
}

export function formatJson(value) {
  return JSON.stringify(value || {}, null, 2);
}
