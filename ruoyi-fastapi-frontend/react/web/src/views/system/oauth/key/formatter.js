import { parseTime } from '@/utils/ruoyi'

export function statusText(value) {
  return (
    {
      pending: '等待接管',
      active: '正在签名',
      retiring: '验证旧凭据',
      retired: '已退出',
      compromised: '疑似泄露',
    }[value] || value
  )
}

export function statusType(value) {
  return (
    {
      pending: 'primary',
      active: 'success',
      retiring: 'warning',
      retired: 'info',
      compromised: 'danger',
    }[value] || 'info'
  )
}

export function roleText(value) {
  return (
    {
      pending: '公钥已发布，尚未签发新凭据',
      active: '正在用于签发新的身份和访问凭据',
      retiring: '不再签发新凭据，只验证尚未到期的旧凭据',
      retired: '已从公开密钥列表移出',
      compromised: '已标记为不可信，请尽快完成应急轮换',
    }[value] || '状态信息未知'
  )
}

export function publicFingerprint(jwk) {
  if (!jwk?.n) {
    return '公开指纹尚未提供'
  }
  return `公开指纹 RSA · ${jwk.n.slice(0, 18)}…`
}

export function nextActionText(row) {
  return (
    {
      pending: '等待开始使用',
      active: '在下一把密钥接管后停止签名',
      retiring: '等待旧凭据全部到期',
      retired: '可以清理元数据',
      compromised: '立即安排应急轮换',
    }[row.status] || '暂无计划'
  )
}

export function nextActionTime(row) {
  if (row.status === 'pending') {
    return parseTime(row.signingStartAt) || '需要手动开始使用'
  }
  if (['retiring', 'retired'].includes(row.status)) {
    return row.removeFromJwksAt
      ? `最早清理：${parseTime(row.removeFromJwksAt)}`
      : '等待安全验证窗口结束'
  }
  if (row.status === 'active') {
    return '当前没有自动停止时间'
  }
  return '请查看安全日志'
}

export function activationDisabledReason(row) {
  const publishAt = new Date(row.publishAt).getTime()
  if (!Number.isFinite(publishAt)) {
    return '公钥公开时间无效，请刷新列表后重试'
  }
  if (publishAt > Date.now()) {
    return `公钥将在 ${parseTime(row.publishAt)} 公开，之后才能开始使用`
  }
  return ''
}
