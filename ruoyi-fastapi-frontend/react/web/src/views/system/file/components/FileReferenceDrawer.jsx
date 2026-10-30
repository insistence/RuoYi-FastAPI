import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { Alert, Drawer } from 'antd'
import FileTag from './FileTag'
import Table from '@/components/Table'
import { listFileReference } from '@/api/system/file'
import { parseTime } from '@/utils/ruoyi'

export default function FileReferenceDrawer({ file, onClose }) {
  useI18n()

  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!file) return
    let active = true
    setLoading(true)
    listFileReference(file.fileId)
      .then((result) => {
        if (active) setRows(result.data || [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [file])
  return (
    <Drawer
      rootClassName="file-drawer"
      title={t('file:businessReferencesValue', { arg0: file?.originalName || '' })}
      open={!!file}
      onClose={onClose}
      size="55%"
    >
      <Alert
        title={t('system:referencedFilesCannotBeMovedToTheRecycleBin')}
        type="warning"
        showIcon
        style={{ marginBottom: 8 }}
      />
      <Table
        rowKey={(row, index) => row.referenceId || `${row.businessType}-${row.businessId}-${index}`}
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1040 }}
        columns={[
          {
            width: 130,
            align: 'center',
            title: t('monitor:log.businessType'),
            dataIndex: 'businessType',
          },
          { width: 180, title: t('system:businessName'), dataIndex: 'businessName' },
          { width: 160, align: 'center', title: t('system:businessId'), dataIndex: 'businessId' },
          {
            align: 'center',
            title: t('system:retentionExpires'),
            dataIndex: 'retentionExpireTime',
            width: 180,
            render: (value) => (value ? parseTime(value) : t('file:retainIndefinitely')),
          },
          {
            width: 100,
            align: 'center',
            title: t('common:source'),
            dataIndex: 'legacy',
            render: (value) => (
              <FileTag
                type={value ? 'info' : 'success'}
                effect="plain"
              >
                {value ? t('system:legacyField') : t('system:references')}
              </FileTag>
            ),
          },
          { width: 110, align: 'center', title: t('system:registeredBy'), dataIndex: 'createBy' },
          {
            align: 'center',
            title: t('system:registeredAt'),
            dataIndex: 'createTime',
            width: 180,
            render: (value) => parseTime(value),
          },
        ]}
      />
    </Drawer>
  )
}
