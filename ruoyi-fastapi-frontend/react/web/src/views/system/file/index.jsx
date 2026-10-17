import {
  LockOutlined,
  SwapOutlined,
  UndoOutlined,
  DeleteFilled,
  DeleteOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  BellOutlined,
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { Button, Space, Tooltip } from 'antd'
import {
  delFile,
  getFile,
  getFileAclDeptTree,
  getFileStats,
  listFile,
  purgeFile,
  restoreFile,
} from '@/api/system/file'
import HasPermi from '@/directive/permission/hasPermi'
import Pagination from '@/components/Pagination'
import RightToolbar from '@/components/RightToolbar'
import download from '@/plugins/download'
import { confirm, message } from '@/plugins/modal'
import FileAclDrawer from './components/FileAclDrawer'
import FileAuditDrawer from './components/FileAuditDrawer'
import FileDetailDialog from './components/FileDetailDialog'
import FileReferenceDrawer from './components/FileReferenceDrawer'
import FileReconcileDrawer from './components/FileReconcileDrawer'
import FileRetentionPolicyDrawer from './components/FileRetentionPolicyDrawer'
import FileRetentionReminderDrawer from './components/FileRetentionReminderDrawer'
import FileSearchForm from './components/FileSearchForm'
import FileStatistics from './components/FileStatistics'
import FileTable from './components/FileTable'
import FileTransferDialog from './components/FileTransferDialog'

export default function File() {
  const [query, setQuery] = useState({
      pageNum: 1,
      pageSize: 10,
      status: 'active',
    }),
    [data, setData] = useState({ rows: [], total: 0 }),
    [stats, setStats] = useState({}),
    [loading, setLoading] = useState(false),
    [showSearch, setShowSearch] = useState(true),
    [selected, setSelected] = useState([]),
    [departments, setDepartments] = useState([]),
    [revision, setRevision] = useState(0),
    [detail, setDetail] = useState(),
    [reference, setReference] = useState(),
    [acl, setAcl] = useState(),
    [transfer, setTransfer] = useState(),
    [audit, setAudit] = useState(),
    [policyOpen, setPolicyOpen] = useState(false),
    [reminderOpen, setReminderOpen] = useState(false),
    [reconcileOpen, setReconcileOpen] = useState(false)
  const refresh = () => {
    setRevision((value) => value + 1)
    setSelected([])
  }
  useEffect(() => {
    getFileAclDeptTree()
      .then((result) => setDepartments(result.data || []))
      .catch(() => {})
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([listFile(query), getFileStats(query)])
      .then(([list, summary]) => {
        if (active) {
          setData(list)
          setStats(summary.data || {})
        }
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [query, revision])
  const privateFiles = selected.filter(
    (row) => row.status === 'active' && row.accessType === 'private'
  )
  const allActive = selected.length > 0 && selected.every((row) => row.status === 'active'),
    references = selected.filter((row) => row.referenceCount > 0).length
  async function mutate(action, row) {
    const rows = row ? [row] : selected
    if (!rows.length) return
    if (action === 'delete' && rows.some((item) => item.referenceCount))
      return message.warning('文件仍被业务引用，请先解除引用后再删除')
    const label = rows.length === 1 ? rows[0].originalName : `${rows.length} 个文件`
    try {
      await confirm(
        {
          delete: `是否将“${label}”移入回收站？`,
          restore: `是否恢复“${label}”？`,
          purge: `永久清理后无法恢复，是否确认清理“${label}”？`,
        }[action]
      )
      await { delete: delFile, restore: restoreFile, purge: purgeFile }[action](
        rows.map((item) => item.fileId).join(',')
      )
      message.success('操作成功')
      refresh()
    } catch {}
  }
  function batchAcl() {
    if (privateFiles.length !== selected.length)
      message.warning('仅对所选正常的受保护文件配置授权，其余文件已忽略')
    setAcl({ files: privateFiles, batch: true })
  }
  return (
    <div className="app-container file-management">
      <FileSearchForm
        show={showSearch}
        deptOptions={departments}
        onQuery={(values) => {
          setQuery({ ...values, pageNum: 1, pageSize: query.pageSize })
          setSelected([])
        }}
      />
      <FileStatistics stats={stats} />
      <div className="table-toolbar">
        <Space wrap>
          <HasPermi value={['system:file:edit']}>
            <Button
              className="ruoyi-plain-button"
              icon={<LockOutlined />}
              disabled={!privateFiles.length}
              onClick={batchAcl}
            >
              授权
            </Button>
          </HasPermi>
          <HasPermi value={['system:file:transfer']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--warning"
              icon={<SwapOutlined />}
              disabled={!allActive}
              onClick={() => setTransfer(selected)}
            >
              转移
            </Button>
          </HasPermi>
          <HasPermi value={['system:file:restore']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--success"
              icon={<UndoOutlined />}
              disabled={!selected.length || selected.some((row) => row.status !== 'deleted')}
              onClick={() => mutate('restore')}
            >
              恢复
            </Button>
          </HasPermi>
          <HasPermi value={['system:file:purge']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--danger"
              icon={<DeleteFilled />}
              disabled={
                !selected.length ||
                selected.some((row) => !['deleted', 'purging'].includes(row.status))
              }
              onClick={() => mutate('purge')}
            >
              清理
            </Button>
          </HasPermi>
          <HasPermi value={['system:file:remove']}>
            <Tooltip title={references ? '所选文件存在业务引用，请先解除引用' : ''}>
              <span>
                <Button
                  className="ruoyi-plain-button ruoyi-plain-button--danger"
                  icon={<DeleteOutlined />}
                  disabled={!allActive || !!references}
                  onClick={() => mutate('delete')}
                >
                  删除
                </Button>
              </span>
            </Tooltip>
          </HasPermi>
          <HasPermi value={['system:file:edit']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--info"
              icon={<ClockCircleOutlined />}
              onClick={() => setPolicyOpen(true)}
            >
              策略
            </Button>
          </HasPermi>
          <HasPermi value={['system:file:reconcile']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--info"
              icon={<ApiOutlined />}
              onClick={() => setReconcileOpen(true)}
            >
              对账
            </Button>
          </HasPermi>
          <HasPermi value={['system:file:list']}>
            <Button
              className="ruoyi-plain-button ruoyi-plain-button--info"
              icon={<BellOutlined />}
              onClick={() => setReminderOpen(true)}
            >
              提醒
            </Button>
          </HasPermi>
        </Space>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={refresh}
        />
      </div>
      <FileTable
        fileList={data.rows}
        loading={loading}
        selected={selected}
        onSelectionChange={setSelected}
        onView={(row) =>
          getFile(row.fileId)
            .then((result) => setDetail(result.data))
            .catch(() => {})
        }
        onDownload={(row) =>
          download.file(
            `/system/file/download/${row.fileId}/${encodeURIComponent(row.storedName || 'file')}`
          )
        }
        onReference={setReference}
        onAcl={(row) => setAcl({ files: [row], batch: false })}
        onTransfer={(row) => setTransfer([row])}
        onAudit={setAudit}
        onDelete={(row) => mutate('delete', row)}
        onRestore={(row) => mutate('restore', row)}
        onPurge={(row) => mutate('purge', row)}
      />
      <Pagination
        total={data.total}
        page={query.pageNum}
        limit={query.pageSize}
        onChange={(page) => {
          setQuery({ ...query, ...page })
          setSelected([])
        }}
      />
      <FileDetailDialog
        open={!!detail}
        detail={detail}
        onClose={() => setDetail(undefined)}
        onReference={setReference}
      />
      <FileReferenceDrawer
        file={reference}
        onClose={() => setReference(undefined)}
      />
      <FileAclDrawer
        files={acl?.files}
        batch={acl?.batch}
        onClose={() => setAcl(undefined)}
        onSuccess={refresh}
      />
      <FileTransferDialog
        files={transfer}
        onClose={() => setTransfer(undefined)}
        onSuccess={refresh}
      />
      <FileAuditDrawer
        file={audit}
        onClose={() => setAudit(undefined)}
      />
      <FileRetentionPolicyDrawer
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
      />
      <FileRetentionReminderDrawer
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        onSuccess={refresh}
      />
      <FileReconcileDrawer
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
        onSuccess={refresh}
      />
    </div>
  )
}
