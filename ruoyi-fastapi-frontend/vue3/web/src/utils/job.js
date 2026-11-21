import { translateMessage } from '../i18n/message.mjs'
/** 校验并解析任务参数，保留JSON值类型 */
export function parseJobParameter(value, field) {
  const isArgs = field === 'jobArgs'
  const message = isArgs
    ? translateMessage(
        'plugins:positionalArgumentsMustBeAJSONArrayEGTest',
        '位置参数必须是JSON数组，例如 ["test", 1]'
      )
    : translateMessage(
        'plugins:keywordArgumentsMustBeAJSONObjectEGEnabled',
        '关键字参数必须是JSON对象，例如 {"enabled": true}'
      )
  let result
  try {
    result = JSON.parse(value)
  } catch {
    throw new Error(message)
  }
  if (
    isArgs
      ? !Array.isArray(result)
      : result === null || Array.isArray(result) || typeof result !== 'object'
  ) {
    throw new Error(message)
  }
  JSON.stringify(result, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) {
      throw new Error(
        translateMessage(
          'plugins:aParameterNumberIsOutsideTheSupportedRange',
          '参数中的数字超出可表示范围'
        )
      )
    }
    return item
  })
  return result
}

/** 将表单中的JSON文本转为接口数组和对象 */
export function buildJobPayload(form) {
  return {
    ...form,
    jobArgs: parseJobParameter(form.jobArgs, 'jobArgs'),
    jobKwargs: parseJobParameter(form.jobKwargs, 'jobKwargs'),
  }
}

// 任务调度同步状态
export const syncStates = {
  pending: { label: translateMessage('plugins:pendingSynchronization', '待同步'), type: 'warning' },
  applied: { label: translateMessage('plugins:active', '已生效'), type: 'success' },
  failed: { label: translateMessage('plugins:synchronizationFailed', '同步失败'), type: 'danger' },
}

// 任务执行状态
export const executionStates = {
  pending: { label: translateMessage('plugins:waitingForDispatch', '等待派发'), type: 'info' },
  submitted: { label: translateMessage('plugins:dispatched', '已派发'), type: 'primary' },
  running: { label: translateMessage('plugins:running', '执行中'), type: 'primary' },
  success: {
    label: translateMessage('plugins:completedSuccessfully', '执行成功'),
    type: 'success',
  },
  failed: { label: translateMessage('plugins:executionFailed', '执行失败'), type: 'danger' },
  rejected: {
    label: translateMessage('plugins:concurrencyLimitReached', '达到并发上限'),
    type: 'warning',
  },
  missed: {
    get label() {
      return translateMessage('components:expired', '已过期')
    },
    type: 'warning',
  },
  cancelled: { label: translateMessage('plugins:cancelled', '已取消'), type: 'info' },
  unknown: {
    label: translateMessage('plugins:resultPendingConfirmation', '结果待确认'),
    type: 'warning',
  },
}

/** 显示任务变更的提交及同步结果 */
export function notifyJobMutation(modal, response) {
  if (response.data?.syncStatus === 'failed') {
    modal.msgWarning(response.msg)
  } else if (response.data?.syncStatus === 'pending') {
    modal.msg(response.msg)
  } else {
    modal.msgSuccess(response.msg)
  }
}
