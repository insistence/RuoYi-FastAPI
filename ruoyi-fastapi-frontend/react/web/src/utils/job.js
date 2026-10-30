import { t } from '../i18n/index.js'
/** 校验并解析任务参数，保留JSON值类型 */
export function parseJobParameter(value, field) {
  const isArgs = field === 'jobArgs'
  const message = isArgs
    ? t('common:positionalArgumentsMustBeAJsonArrayEG')
    : t('common:keywordArgumentsMustBeAJsonObjectEG')
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
      throw new Error(t('common:aParameterNumberIsOutsideTheSupportedRange'))
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
  pending: {
    get label() {
      return t('common:pendingSynchronization')
    },
    type: 'warning',
  },
  applied: {
    get label() {
      return t('common:active')
    },
    type: 'success',
  },
  failed: {
    get label() {
      return t('common:synchronizationFailed')
    },
    type: 'danger',
  },
}

// 任务执行状态
export const executionStates = {
  pending: {
    get label() {
      return t('common:waitingForDispatch')
    },
    type: 'info',
  },
  submitted: {
    get label() {
      return t('common:dispatched')
    },
    type: 'primary',
  },
  running: {
    get label() {
      return t('common:running')
    },
    type: 'primary',
  },
  success: {
    get label() {
      return t('common:completedSuccessfully')
    },
    type: 'success',
  },
  failed: {
    get label() {
      return t('common:executionFailed')
    },
    type: 'danger',
  },
  rejected: {
    get label() {
      return t('common:concurrencyLimitReached')
    },
    type: 'warning',
  },
  missed: {
    get label() {
      return t('common:expired')
    },
    type: 'warning',
  },
  cancelled: {
    get label() {
      return t('common:cancelled')
    },
    type: 'info',
  },
  unknown: {
    get label() {
      return t('common:resultPendingConfirmation')
    },
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
