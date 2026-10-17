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
    ? '（无）'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value)
export default function JobDetail({ open, row = {}, type = 'job', onClose }) {
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
      {String(row.status) === '0' ? '正常' : log ? '失败' : '暂停'}
    </Tag>
  )
  return (
    <Modal
      className="job-dialog job-detail"
      open={open}
      title={log ? '调度日志详细' : '任务详细'}
      width={780}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关 闭</Button>}
    >
      <div className="detail-wrap">
        {log ? (
          <>
            <DetailCard
              title="基本信息"
              icon={<InfoCircleOutlined />}
            >
              <DetailFields
                items={[
                  field('日志编号', row.jobLogId),
                  field('执行状态', status),
                  field('计划时间', parseTime(row.scheduledTime) || '-'),
                  field('任务时区', row.timeZone || '-'),
                  field('开始时间', parseTime(row.startTime) || '-'),
                  field('结束时间', parseTime(row.endTime) || '-'),
                  field('记录时间', parseTime(row.createTime) || '-'),
                  row.runDurationMs != null && field('执行耗时', `${row.runDurationMs} 毫秒`),
                ]}
              />
            </DetailCard>
            <DetailCard
              title="任务信息"
              icon={<ClockCircleOutlined />}
            >
              <DetailFields
                items={[
                  field('任务编号', row.jobId ?? '历史未关联'),
                  field('调度存储', store),
                  field('执行编号', row.executionId || '历史未关联', true, true),
                  field('任务名称', row.jobName),
                  field('任务分组', row.jobGroup),
                  field('任务执行器', executor),
                  field('任务触发器', row.jobTrigger || '-'),
                  field('日志信息', row.jobMessage, true),
                ]}
              />
            </DetailCard>
          </>
        ) : (
          <>
            <DetailCard
              title="任务配置"
              icon={<SettingOutlined />}
            >
              <DetailFields
                items={[
                  field('任务编号', row.jobId),
                  field('任务名称', row.jobName),
                  field('任务分组', row.jobGroup),
                  field('执行状态', status),
                  field('任务执行器', executor, true),
                ]}
              />
            </DetailCard>
            <DetailCard
              title="调度信息"
              icon={<CalendarOutlined />}
            >
              <DetailFields
                items={[
                  field(
                    '调度同步',
                    <Tag
                      color={
                        { success: 'success', danger: 'error', warning: 'warning' }[
                          syncStates[row.syncStatus]?.type
                        ] || 'warning'
                      }
                    >
                      {syncStates[row.syncStatus]?.label || '待同步'}
                    </Tag>
                  ),
                  field(
                    '配置版本',
                    `已应用 ${row.appliedVersion ?? 0} / 最新 ${row.configVersion ?? '—'}`
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
                  field('cron 表达式', row.cronExpression, false, true),
                  field('Cron 时区', row.timeZone),
                  field(
                    '实际下次调度',
                    row.status === '1' ? '已停用' : parseTime(row.nextRunTime) || '暂无有效调度观测'
                  ),
                  field('Cron理论预览', parseTime(row.cronNextTime) || '无未来时刻'),
                  field(
                    '调度观测时间',
                    `${parseTime(row.scheduleObservedTime) || '-'}；理论预览仅按Cron规则计算，不代表已安排执行。`,
                    true
                  ),
                  field(
                    '允许延迟',
                    row.misfireGraceTime === null
                      ? '不限'
                      : `${row.misfireGraceTime ?? '-'} 秒，超时跳过`
                  ),
                  field('最大并发数', `${row.maxInstances ?? '-'}（定时与手动共用）`),
                  field('积压处理', row.coalesce ? '只执行最近一次' : '逐次执行'),
                  field('调度存储', store),
                ]}
              />
            </DetailCard>
          </>
        )}
        <DetailCard
          title={log ? '调用目标' : '执行方法'}
          icon={<ThunderboltOutlined />}
        >
          <DetailCode value={row.invokeTarget || '（无）'} />
        </DetailCard>
        <DetailCard
          title="调用参数"
          icon={<FileTextOutlined />}
        >
          <DetailFields
            items={[
              field('位置参数', displayArgs(row.jobArgs), true, true),
              field('关键字参数', displayArgs(row.jobKwargs), true, true),
            ]}
          />
        </DetailCard>
        {log && String(row.status) === '1' && (
          <DetailCard
            title="异常信息"
            icon={<WarningOutlined />}
            error
          >
            <DetailError>{row.exceptionInfo}</DetailError>
          </DetailCard>
        )}
        {!log && (
          <DetailCard
            title="元信息"
            icon={<FileTextOutlined />}
          >
            <DetailFields
              items={[
                field('创建人', row.createBy || '-'),
                field('创建时间', parseTime(row.createTime) || '-'),
                field('更新人', row.updateBy || '-'),
                field('更新时间', parseTime(row.updateTime) || '-'),
                row.remark && field('备注', row.remark, true),
              ]}
            />
          </DetailCard>
        )}
      </div>
    </Modal>
  )
}
