import { formatFileSize } from './fileFormatters'
const issueTypeOptions = [
  { label: '元数据不合法', value: 'invalid_metadata' },
  { label: '物理文件缺失', value: 'missing_file' },
  { label: '有效文件位于回收站', value: 'unexpected_trash' },
  { label: '回收文件位于正式区', value: 'unexpected_source' },
  { label: '重复物理文件', value: 'duplicate_file' },
  { label: '存储区域错误', value: 'wrong_storage_root' },
  { label: '文件大小不一致', value: 'size_mismatch' },
  { label: '文件摘要不一致', value: 'hash_mismatch' },
  { label: '孤立物理文件', value: 'orphan_file' },
  { label: '不安全目录项', value: 'unsafe_entry' },
]
const dangerousActions = ['delete_quarantine', 'accept_current', 'register_orphan']
const actionDescriptions = {
  ignore: '保留异常但不再计入待处理数量，后续可重新打开。',
  reopen: '将已忽略异常重新置为待处理。',
  restore_source: '把回收区中的物理文件恢复到登记的正式存储位置。',
  move_to_trash: '把正式存储区中的回收文件移入登记的回收区位置。',
  move_to_expected_root: '把物理文件移动到文件信息表登记的存储区域。',
  quarantine_file: '把异常副本或孤立文件移入不可公开访问的隔离区。',
  restore_quarantine: '把隔离文件恢复到隔离前的位置，异常会重新打开。',
  delete_quarantine: '永久删除隔离文件，此操作不可恢复。',
  accept_current: '以当前物理文件重新计算大小和摘要并更新文件信息表。',
  register_orphan: '把孤立物理文件登记为当前管理员所有的有效文件。',
}

function formatLocation(root, key) {
  return root && key ? `${root}:${key}` : '-'
}

function formatOptionalSize(size) {
  return size === null || size === undefined ? '-' : formatFileSize(size)
}

function issueTypeLabel(type) {
  return issueTypeOptions.find((item) => item.value === type)?.label || type
}

function severityLabel(severity) {
  return { critical: '严重', warning: '警告', info: '提示' }[severity] || severity
}

function severityTagType(severity) {
  return { critical: 'danger', warning: 'warning', info: 'info' }[severity] || 'info'
}

function issueStatusLabel(status) {
  return (
    {
      open: '待处理',
      ignored: '已忽略',
      quarantined: '已隔离',
      resolved: '已解决',
    }[status] || status
  )
}

function issueStatusType(status) {
  return (
    {
      open: 'danger',
      ignored: 'info',
      quarantined: 'warning',
      resolved: 'success',
    }[status] || 'info'
  )
}

function runStatusLabel(status) {
  return (
    {
      running: '运行中',
      completed: '已完成',
      failed: '失败',
    }[status] || '尚未执行'
  )
}

function runStatusType(status) {
  return (
    {
      running: 'warning',
      completed: 'success',
      failed: 'danger',
    }[status] || 'info'
  )
}

function actionLabel(action) {
  return (
    {
      ignore: '忽略异常',
      reopen: '重新打开',
      restore_source: '恢复到正式区',
      move_to_trash: '移入回收区',
      move_to_expected_root: '移到预期区域',
      quarantine_file: '隔离文件',
      restore_quarantine: '恢复隔离文件',
      delete_quarantine: '永久删除隔离文件',
      accept_current: '接受当前文件',
      register_orphan: '登记孤立文件',
    }[action] || action
  )
}

export {
  issueTypeOptions,
  dangerousActions,
  actionDescriptions,
  formatLocation,
  formatOptionalSize,
  issueTypeLabel,
  severityLabel,
  severityTagType,
  issueStatusLabel,
  issueStatusType,
  runStatusLabel,
  runStatusType,
  actionLabel,
}
