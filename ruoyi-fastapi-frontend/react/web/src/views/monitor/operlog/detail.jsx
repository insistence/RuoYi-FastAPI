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
  if (!value) return '（无数据）'
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2)
  } catch {
    return String(value)
  }
}
export default function OperlogDetail({ open, row = {}, onClose }) {
  const { sys_oper_type } = useDict('sys_oper_type')
  const field = (label, value, full = false, mono = false) => ({ label, value, full, mono })
  return (
    <Modal
      title="操作日志详细"
      open={open}
      onCancel={onClose}
      width={780}
      footer={null}
    >
      <div className="detail-wrap">
        <DetailCard
          title="基本信息"
          icon={<InfoCircleOutlined />}
        >
          <DetailFields
            items={[
              field('操作模块', row.title),
              field(
                '业务类型',
                <DictTag
                  value={row.businessType}
                  options={sys_oper_type}
                />
              ),
              field('操作时间', parseTime(row.operTime) || '-'),
              field(
                '执行状态',
                <Tag color={String(row.status) === '0' ? 'success' : 'error'}>
                  {String(row.status) === '0' ? '正常' : '异常'}
                </Tag>
              ),
            ]}
          />
        </DetailCard>
        <DetailCard
          title="操作人员"
          icon={<UserOutlined />}
        >
          <DetailFields
            items={[
              field('操作人员', row.operName),
              row.deptName && field('所属部门', row.deptName),
              field(
                '操作地址',
                <>
                  {row.operIp}　<span className="detail-location">{row.operLocation}</span>
                </>,
                true
              ),
            ]}
          />
        </DetailCard>
        <DetailCard
          title="请求信息"
          icon={<SwapOutlined />}
        >
          <DetailFields
            items={[
              field(
                '请求地址',
                <>
                  <span className={`method-tag method-${row.requestMethod}`}>
                    {row.requestMethod}
                  </span>
                  {row.operUrl}
                </>,
                true
              ),
              field('操作方法', row.method, true, true),
              field('消耗时间', `${row.costTime ?? '-'} 毫秒`),
            ]}
          />
        </DetailCard>
        <DetailCard
          title="请求参数"
          icon={<UploadOutlined />}
        >
          <DetailCode
            value={formatJson(row.operParam)}
            copyable
          />
        </DetailCard>
        <DetailCard
          title="返回参数"
          icon={<DownloadOutlined />}
        >
          <DetailCode
            value={formatJson(row.jsonResult)}
            copyable
          />
        </DetailCard>
        {String(row.status) !== '0' && (
          <DetailCard
            title="异常信息"
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
