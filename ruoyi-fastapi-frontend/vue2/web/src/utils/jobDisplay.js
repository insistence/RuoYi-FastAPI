import { t } from '@/i18n/adapter'
import {
  syncStates as originalSyncStates,
  executionStates as originalExecutionStates,
  parseJobParameter as parseOriginalJobParameter,
} from './job'
export { notifyJobMutation } from './job'

export function parseJobParameter(value, field) {
  try {
    return parseOriginalJobParameter(value, field)
  } catch (error) {
    const messages = {
      INVALID_JOB_ARGS: t('monitor:job.invalidArgs'),
      INVALID_JOB_KWARGS: t('monitor:job.invalidKwargs'),
      JOB_NUMBER_OUT_OF_RANGE: t('monitor:job.numberOutOfRange'),
    }
    if (messages[error.code]) error.message = messages[error.code]
    throw error
  }
}

export function buildJobPayload(form) {
  return {
    ...form,
    jobArgs: parseJobParameter(form.jobArgs, 'jobArgs'),
    jobKwargs: parseJobParameter(form.jobKwargs, 'jobKwargs'),
  }
}

export const syncStates = {
  pending: {
    ...originalSyncStates.pending,
    get label() {
      return t('monitor:job.sync.pending')
    },
  },
  applied: {
    ...originalSyncStates.applied,
    get label() {
      return t('monitor:job.sync.applied')
    },
  },
  failed: {
    ...originalSyncStates.failed,
    get label() {
      return t('monitor:job.sync.failed')
    },
  },
}
export const executionStates = {
  pending: {
    ...originalExecutionStates.pending,
    get label() {
      return t('monitor:job.execution.pending')
    },
  },
  submitted: {
    ...originalExecutionStates.submitted,
    get label() {
      return t('monitor:job.execution.submitted')
    },
  },
  running: {
    ...originalExecutionStates.running,
    get label() {
      return t('monitor:job.execution.running')
    },
  },
  success: {
    ...originalExecutionStates.success,
    get label() {
      return t('monitor:job.execution.success')
    },
  },
  failed: {
    ...originalExecutionStates.failed,
    get label() {
      return t('monitor:job.execution.failed')
    },
  },
  rejected: {
    ...originalExecutionStates.rejected,
    get label() {
      return t('monitor:job.execution.rejected')
    },
  },
  missed: {
    ...originalExecutionStates.missed,
    get label() {
      return t('monitor:job.execution.missed')
    },
  },
  cancelled: {
    ...originalExecutionStates.cancelled,
    get label() {
      return t('monitor:job.execution.cancelled')
    },
  },
  unknown: {
    ...originalExecutionStates.unknown,
    get label() {
      return t('monitor:job.execution.unknown')
    },
  },
}
