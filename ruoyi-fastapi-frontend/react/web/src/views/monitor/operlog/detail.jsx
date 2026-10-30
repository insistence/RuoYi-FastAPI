import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Modal, Tag } from 'antd'
import {
  InfoCircleOutlined,
  UserOutlined,
  SwapOutlined,
  UploadOutlined,
  DownloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { parseTime } from '@/utils/ruoyi'
import { useDict } from '@/utils/dict'
import DictTag from '@/components/DictTag'
import { DetailCard, DetailFields, DetailCode, DetailError } from '@/components/DetailPanel'

function formatJson(value) {
  if (!value) return t('monitor:noData')
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2)
  } catch {
    return String(value)
  }
}
export default function OperlogDetail({ open, row = {}, onClose }) {
  useI18n()

  const { sys_oper_type } = useDict('sys_oper_type')
  const field = (label, value, full = false, mono = false) => ({ label, value, full, mono })
  return (
    <Modal
      title={t('monitor:operationLogDetails')}
      open={open}
      onCancel={onClose}
      width={780}
      footer={null}
    >
      <div className="detail-wrap">
        <DetailCard
          title={t('common:basicInfo')}
          icon={<InfoCircleOutlined />}
        >
          <DetailFields
            items={[
              field(t('monitor:module'), row.title),
              field(
                t('monitor:log.businessType'),
                <DictTag
                  value={row.businessType}
                  options={sys_oper_type}
                />
              ),
              field(t('monitor:log.operationTime'), parseTime(row.operTime) || '-'),
              field(
                t('monitor:job.executionStatus'),
                <Tag color={String(row.status) === '0' ? 'success' : 'error'}>
                  {String(row.status) === '0' ? t('layout:notices.active') : t('common:exception')}
                </Tag>
              ),
            ]}
          />
        </DetailCard>
        <DetailCard
          title={t('monitor:log.operator')}
          icon={<UserOutlined />}
        >
          <DetailFields
            items={[
              field(t('monitor:log.operator'), row.operName),
              row.deptName && field(t('system:user.department'), row.deptName),
              field(
                t('monitor:operationAddress'),
                <>
                  {row.operIp}　<span className="detail-location">{row.operLocation}</span>
                </>,
                true
              ),
            ]}
          />
        </DetailCard>
        <DetailCard
          title={t('monitor:requestInformation')}
          icon={<SwapOutlined />}
        >
          <DetailFields
            items={[
              field(
                t('monitor:requestUrl'),
                <>
                  <span className={`method-tag method-${row.requestMethod}`}>
                    {row.requestMethod}
                  </span>
                  {row.operUrl}
                </>,
                true
              ),
              field(t('monitor:operationMethod'), row.method, true, true),
              field(
                t('monitor:duration'),
                t('monitor:operlog.valueMs', { arg0: row.costTime ?? '-' })
              ),
            ]}
          />
        </DetailCard>
        <DetailCard
          title={t('monitor:requestParameters')}
          icon={<UploadOutlined />}
        >
          <DetailCode
            value={formatJson(row.operParam)}
            copyable
          />
        </DetailCard>
        <DetailCard
          title={t('monitor:responseData')}
          icon={<DownloadOutlined />}
        >
          <DetailCode
            value={formatJson(row.jsonResult)}
            copyable
          />
        </DetailCard>
        {String(row.status) !== '0' && (
          <DetailCard
            title={t('monitor:exceptionDetails')}
            icon={<WarningOutlined />}
            error
          >
            <DetailError>{row.errorMsg}</DetailError>
          </DetailCard>
        )}
      </div>
    </Modal>
  )
}
