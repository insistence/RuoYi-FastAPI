import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { Alert, Button, Modal, Tag } from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { parseTime } from '@/utils/ruoyi'
import { useDict } from '@/utils/dict'
import { syncStates } from '@/utils/job'
import DictTag from '@/components/DictTag'
import { DetailCard, DetailFields, DetailCode, DetailError } from '@/components/DetailPanel'

const displayArgs = (value) =>
  value == null || value === ''
    ? t('monitor:none')
    : typeof value === 'string'
      ? value
      : JSON.stringify(value)
export default function JobDetail({ open, row = {}, type = 'job', onClose }) {
  useI18n()

  const { sys_job_executor, sys_job_store } = useDict('sys_job_executor', 'sys_job_store')
  const log = type === 'log'
  const field = (label, value, full = false, mono = false) => ({ label, value, full, mono })
  const executor = (
    <DictTag
      value={row.jobExecutor}
      options={sys_job_executor}
    />
  )
  const store = (
    <DictTag
      value={row.jobStore}
      options={sys_job_store}
    />
  )
  const status = (
    <Tag color={String(row.status) === '0' ? 'success' : log ? 'error' : 'default'}>
      {String(row.status) === '0'
        ? t('layout:notices.active')
        : log
          ? t('common:failed')
          : t('monitor:pause')}
    </Tag>
  )
  return (
    <Modal
      className="job-dialog job-detail"
      open={open}
      title={log ? t('monitor:schedulerLogDetails') : t('monitor:taskDetails')}
      width={780}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('common:close')}</Button>}
    >
      <div className="detail-wrap">
        {log ? (
          <>
            <DetailCard
              title={t('common:basicInfo')}
              icon={<InfoCircleOutlined />}
            >
              <DetailFields
                items={[
                  field(t('monitor:log.id'), row.jobLogId),
                  field(t('monitor:job.executionStatus'), status),
                  field(t('monitor:scheduledTime'), parseTime(row.scheduledTime) || '-'),
                  field(t('monitor:taskTimeZone'), row.timeZone || '-'),
                  field(t('common:startTime'), parseTime(row.startTime) || '-'),
                  field(t('common:endTime'), parseTime(row.endTime) || '-'),
                  field(t('monitor:recordedAt'), parseTime(row.createTime) || '-'),
                  row.runDurationMs != null &&
                    field(
                      t('monitor:executionDuration'),
                      t('monitor:valueMs', { runDurationMs: row.runDurationMs })
                    ),
                ]}
              />
            </DetailCard>
            <DetailCard
              title={t('monitor:taskInformation')}
              icon={<ClockCircleOutlined />}
            >
              <DetailFields
                items={[
                  field(t('monitor:job.id'), row.jobId ?? t('monitor:noLinkedHistory')),
                  field(t('monitor:job.store'), store),
                  field(
                    t('monitor:executionId'),
                    row.executionId || t('monitor:noLinkedHistory'),
                    true,
                    true
                  ),
                  field(t('monitor:job.name'), row.jobName),
                  field(t('monitor:job.group'), row.jobGroup),
                  field(t('monitor:job.executor'), executor),
                  field(t('monitor:taskTrigger'), row.jobTrigger || '-'),
                  field(t('monitor:logInformation'), row.jobMessage, true),
                ]}
              />
            </DetailCard>
          </>
        ) : (
          <>
            <DetailCard
              title={t('monitor:taskConfiguration')}
              icon={<SettingOutlined />}
            >
              <DetailFields
                items={[
                  field(t('monitor:job.id'), row.jobId),
                  field(t('monitor:job.name'), row.jobName),
                  field(t('monitor:job.group'), row.jobGroup),
                  field(t('monitor:job.executionStatus'), status),
                  field(t('monitor:job.executor'), executor, true),
                ]}
              />
            </DetailCard>
            <DetailCard
              title={t('monitor:schedulingInformation')}
              icon={<CalendarOutlined />}
            >
              <DetailFields
                items={[
                  field(
                    t('monitor:schedulerSynchronization'),
                    <Tag
                      color={
                        { success: 'success', danger: 'error', warning: 'warning' }[
                          syncStates[row.syncStatus]?.type
                        ] || 'warning'
                      }
                    >
                      {syncStates[row.syncStatus]?.label || t('common:pendingSynchronization')}
                    </Tag>
                  ),
                  field(
                    t('monitor:configurationVersion'),
                    t('monitor:appliedValueLatestValue', {
                      arg0: row.appliedVersion ?? 0,
                      arg1: row.configVersion ?? '—',
                    })
                  ),
                ]}
              />
              {row.syncError && (
                <Alert
                  title={row.syncError}
                  type="error"
                  showIcon
                />
              )}
              <DetailFields
                items={[
                  field(t('monitor:cronExpression'), row.cronExpression, false, true),
                  field(t('monitor:cronTimeZone'), row.timeZone),
                  field(
                    t('monitor:actualNextRun'),
                    row.status === '1'
                      ? t('common:disabled')
                      : parseTime(row.nextRunTime) || t('monitor:noValidSchedulingObservations')
                  ),
                  field(
                    t('monitor:cronSchedulePreview'),
                    parseTime(row.cronNextTime) || t('monitor:noFutureOccurrence')
                  ),
                  field(
                    t('monitor:schedulerObservedAt'),
                    t('monitor:valueTheTheoreticalPreviewFollowsCronRulesAndDoes', {
                      arg0: parseTime(row.scheduleObservedTime) || '-',
                    }),
                    true
                  ),
                  field(
                    t('monitor:allowedDelay'),
                    row.misfireGraceTime === null
                      ? t('monitor:unlimited')
                      : t('monitor:valueSecondsSkipAfterTimeout', {
                          arg0: row.misfireGraceTime ?? '-',
                        })
                  ),
                  field(
                    t('monitor:maximumConcurrency'),
                    t('monitor:valueSharedByScheduledAndManualRuns', {
                      arg0: row.maxInstances ?? '-',
                    })
                  ),
                  field(
                    t('monitor:missedRuns'),
                    row.coalesce
                      ? t('monitor:runOnlyTheLatestOccurrence')
                      : t('monitor:runEachOccurrence')
                  ),
                  field(t('monitor:job.store'), store),
                ]}
              />
            </DetailCard>
          </>
        )}
        <DetailCard
          title={log ? t('monitor:job.target') : t('monitor:executionMethod')}
          icon={<ThunderboltOutlined />}
        >
          <DetailCode value={row.invokeTarget || t('monitor:none')} />
        </DetailCard>
        <DetailCard
          title={t('monitor:callArguments')}
          icon={<FileTextOutlined />}
        >
          <DetailFields
            items={[
              field(t('monitor:job.args'), displayArgs(row.jobArgs), true, true),
              field(t('monitor:job.kwargs'), displayArgs(row.jobKwargs), true, true),
            ]}
          />
        </DetailCard>
        {log && String(row.status) === '1' && (
          <DetailCard
            title={t('monitor:exceptionDetails')}
            icon={<WarningOutlined />}
            error
          >
            <DetailError>{row.exceptionInfo}</DetailError>
          </DetailCard>
        )}
        {!log && (
          <DetailCard
            title={t('monitor:metadata')}
            icon={<FileTextOutlined />}
          >
            <DetailFields
              items={[
                field(t('monitor:createdBy'), row.createBy || '-'),
                field(t('common:createdTime'), parseTime(row.createTime) || '-'),
                field(t('monitor:updatedBy'), row.updateBy || '-'),
                field(t('common:updatedTime'), parseTime(row.updateTime) || '-'),
                row.remark && field(t('common:remark'), row.remark, true),
              ]}
            />
          </DetailCard>
        )}
      </div>
    </Modal>
  )
}
