export function canInstall(row) {
  return (
    !isOrphanPlugin(row) &&
    row?.source !== "artifact" &&
    (!row.installedVersion ||
      row.status === "discovered" ||
      row.status === "error")
  );
}

export function canUpgrade(row) {
  return (
    !isOrphanPlugin(row) &&
    row?.source !== "artifact" &&
    row.status === "pending_upgrade"
  );
}

export function canUninstall(row) {
  return (
    !isOrphanPlugin(row) &&
    row?.source !== "artifact" &&
    row.installedVersion &&
    row.enabled === "0"
  );
}

export function isOrphanPlugin(row) {
  return row?.source === "orphan";
}

export function canExecuteActionResult(result) {
  return (
    !result.error &&
    !isCapabilityOperationBlocked(result.capability, result.operation) &&
    result.dryRun &&
    result.structureOk !== false &&
    result.menuConflictOk !== false
  );
}

export function isOperationBlocked(row, operation) {
  return (
    row?.source === "artifact" ||
    isCapabilityOperationBlocked(row?.capability, operation)
  );
}

export function isCapabilityOperationBlocked(capability, operation) {
  return (
    Array.isArray(capability?.blockedOperations) &&
    capability.blockedOperations.includes(operation)
  );
}

export function canSelectForBatch(row) {
  return !isOrphanPlugin(row) && row?.source !== "artifact";
}
