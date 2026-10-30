import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import FileTag from './FileTag'
import { TableAction } from '@/components/TableActions'
import './style.css'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Drawer, Empty, Select, Space, Switch, Tooltip, TreeSelect } from 'antd'
import Table from '@/components/Table'
import { PlusOutlined } from '@ant-design/icons'
import {
  batchSaveFileAcl,
  getFileAclDeptTree,
  listFileAcl,
  saveFileAcl,
  searchFileAclSubjects,
} from '@/api/system/file'
import BusinessDateTimePicker from '@/components/BusinessDateTimePicker'
import { prepareTimeFields, serializeTimeFieldsForSubmit } from '@/utils/time'
import { confirm, message } from '@/plugins/modal'

export default function FileAclDrawer({ files, batch = false, onClose, onSuccess }) {
  useI18n()

  const [entries, setEntries] = useState([]),
    [builtin, setBuiltin] = useState([]),
    [departments, setDepartments] = useState([]),
    [version, setVersion] = useState(),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false)
  const sequence = useRef(0),
    subjectRequests = useRef(new Map())
  useEffect(() => {
    const current = ++sequence.current
    subjectRequests.current.clear()
    setEntries([])
    setBuiltin([])
    setVersion(undefined)
    if (!files?.length) return
    setLoading(true)
    Promise.all([
      getFileAclDeptTree(),
      batch ? Promise.resolve({ data: { entries: [] } }) : listFileAcl(files[0].fileId),
    ])
      .then(([dept, result]) => {
        if (current !== sequence.current) return
        setDepartments(dept.data || [])
        setVersion(result.data.aclVersion)
        setBuiltin(result.data.builtinPermissions || [])
        setEntries(
          (result.data.entries || []).map((entry, index) => ({
            ...prepareTimeFields(entry, ['expireTime']),
            key: index,
            subjectOptions: [
              { value: entry.subjectId, label: entry.subjectName || String(entry.subjectId) },
            ],
          }))
        )
      })
      .catch(() => {})
      .finally(() => current === sequence.current && setLoading(false))
    return () => {
      sequence.current++
    }
  }, [files, batch])
  function update(key, patch) {
    setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }
  async function search(row, keyword) {
    const requestId = (subjectRequests.current.get(row.key) || 0) + 1
    subjectRequests.current.set(row.key, requestId)
    const current = sequence.current
    const isCurrent = () =>
      current === sequence.current && subjectRequests.current.get(row.key) === requestId
    update(row.key, { subjectLoading: true })
    try {
      const result = await searchFileAclSubjects({ subjectType: row.subjectType, keyword })
      if (isCurrent())
        update(row.key, {
          subjectOptions: (result.data || []).map((item) => ({
            value: item.subjectId,
            label: item.subjectName,
          })),
        })
    } finally {
      if (isCurrent()) update(row.key, { subjectLoading: false })
    }
  }
  function addEntry() {
    setEntries((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        subjectType: 'user',
        effect: 'allow',
        includeChildren: false,
        subjectOptions: [],
      },
    ])
  }
  async function save() {
    if (entries.some((entry) => !entry.subjectId))
      return message.warning(t('system:selectACompletePermissionPrincipal'))
    setSaving(true)
    try {
      const payload = []
      for (const entry of entries) {
        const value = await serializeTimeFieldsForSubmit(entry, ['expireTime'])
        if (!value) return
        payload.push({
          subjectType: value.subjectType,
          subjectId: value.subjectId,
          effect: value.effect,
          includeChildren: value.subjectType === 'dept' && !!value.includeChildren,
          expireTime: value.expireTime || null,
        })
      }
      if (batch) {
        await confirm(
          t('system:replaceAllPermissionsForTheValueSelectedFiles', { length: files.length })
        )
        await batchSaveFileAcl({
          fileIds: files.map((file) => file.fileId).join(','),
          entries: payload,
        })
      } else {
        await saveFileAcl(files[0].fileId, { aclVersion: version, entries: payload })
      }
      message.success(
        batch
          ? t('system:filePermissionsSavedForAllSelectedFiles')
          : t('system:filePermissionsSaved')
      )
      onSuccess()
      onClose()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Drawer
      rootClassName="file-drawer file-acl-drawer"
      title={
        batch
          ? t('system:batchPermissionsValueFiles', { arg0: files?.length || 0 })
          : t('system:accessPermissionsValue', { arg0: files?.[0]?.originalName || '' })
      }
      open={!!files?.length}
      onClose={onClose}
      placement="right"
      size="70%"
      mask={{ closable: !saving }}
      destroyOnHidden
      footer={
        <Space className="dialog-footer">
          <Button
            type="primary"
            loading={saving}
            disabled={loading}
            onClick={save}
          >
            {t('system:save')}
          </Button>
          <Button onClick={onClose}>{t('system:components.cancel')}</Button>
        </Space>
      }
    >
      <Alert
        showIcon
        type="info"
        className="mb8"
        title={
          batch
            ? t('file:batchOperationsReplaceOnlyExplicitPermissionsOnSelectedFiles')
            : t('file:builtInPermissionsAreReadOnlyAdministratorsAndOwners')
        }
      />
      {!batch && (
        <section className="permission-section">
          <div className="permission-section__title">{t('system:builtInPermissions')}</div>
          <Table
            rowKey="source"
            loading={loading}
            dataSource={builtin}
            bordered
            pagination={false}
            scroll={{ x: 855 }}
            columns={[
              {
                title: t('system:permissionSource'),
                align: 'center',
                width: 110,
                dataIndex: 'source',
                render: (source) => (
                  <FileTag
                    effect="plain"
                    type={{ admin: 'danger', owner: 'primary', uploader: 'warning' }[source]}
                  >
                    {{
                      admin: t('system:platformAdministrator'),
                      owner: t('system:fileOwner'),
                      uploader: t('system:fileUploader'),
                    }[source] || source}
                  </FileTag>
                ),
              },
              {
                title: t('system:permissionPrincipal'),
                align: 'center',
                width: 180,
                render: (_, row) => row.subjectName || row.subjectId || '-',
              },
              {
                title: t('system:rule'),
                align: 'center',
                width: 110,
                render: (_, row) => (
                  <FileTag
                    effect="plain"
                    type={row.enabled ? 'success' : 'info'}
                  >
                    {row.enabled ? t('system:allowDownload') : t('file:removed')}
                  </FileTag>
                ),
              },
              {
                title: t('system:denyTakesPrecedence'),
                align: 'center',
                width: 135,
                render: (_, row) =>
                  row.enabled ? (
                    <FileTag
                      effect="plain"
                      type={row.denyOverridable ? 'warning' : 'info'}
                    >
                      {row.denyOverridable
                        ? t('file:canBeOverridden')
                        : t('file:cannotBeOverridden')}
                    </FileTag>
                  ) : (
                    '-'
                  ),
              },
              {
                width: 320,
                title: t('system:permissionDetails'),
                dataIndex: 'description',
                ellipsis: true,
              },
            ]}
          />
        </section>
      )}
      <div className="permission-section__header">
        <span className="permission-section__title">{t('system:explicitPermissions')}</span>
        <Button
          className="ruoyi-plain-button"
          icon={<PlusOutlined />}
          onClick={addEntry}
        >
          {t('system:addPermission')}
        </Button>
      </div>
      <Table
        rowKey="key"
        loading={loading}
        dataSource={entries}
        pagination={false}
        locale={{ emptyText: <Empty description={t('layout:notices.noData')} /> }}
        scroll={{ x: 980 }}
        columns={[
          {
            title: t('system:principalType'),
            align: 'center',
            width: 125,
            render: (_, row) => (
              <Select
                style={{ width: '100%' }}
                value={row.subjectType}
                aria-label={t('system:principalType')}
                options={[
                  { value: 'user', label: t('system:user.user') },
                  { value: 'role', label: t('system:user.role') },
                  { value: 'dept', label: t('system:dept.nameShort') },
                ]}
                onChange={(subjectType) => {
                  subjectRequests.current.set(
                    row.key,
                    (subjectRequests.current.get(row.key) || 0) + 1
                  )
                  update(row.key, {
                    subjectType,
                    subjectId: undefined,
                    includeChildren: false,
                    subjectOptions: [],
                    subjectLoading: false,
                  })
                }}
              />
            ),
          },
          {
            title: t('system:principal'),
            align: 'center',
            width: 230,
            render: (_, row) =>
              row.subjectType === 'dept' ? (
                <TreeSelect
                  style={{ width: '100%' }}
                  value={row.subjectId}
                  treeData={departments}
                  fieldNames={{ value: 'id', label: 'label' }}
                  showSearch
                  treeNodeFilterProp="label"
                  allowClear
                  placeholder={t('system:selectADepartment')}
                  aria-label={t('file:authorizedDepartments')}
                  onChange={(subjectId) => update(row.key, { subjectId })}
                />
              ) : (
                <Select
                  style={{ width: '100%' }}
                  allowClear
                  placeholder={t('system:searchByName')}
                  aria-label={t('system:principal')}
                  loading={row.subjectLoading}
                  showSearch={{
                    filterOption: false,
                    onSearch: (keyword) => search(row, keyword).catch(() => {}),
                  }}
                  value={row.subjectId}
                  options={row.subjectOptions}
                  onOpenChange={(open) =>
                    open && !row.subjectOptions.length && search(row, '').catch(() => {})
                  }
                  onChange={(subjectId) => update(row.key, { subjectId })}
                />
              ),
          },
          {
            title: t('system:rule'),
            align: 'center',
            width: 120,
            render: (_, row) => (
              <Select
                style={{ width: '100%' }}
                value={row.effect}
                aria-label={t('file:authorizationRules')}
                options={[
                  { value: 'allow', label: t('system:allowDownload') },
                  { value: 'deny', label: t('system:denyDownload') },
                ]}
                onChange={(effect) => update(row.key, { effect })}
              />
            ),
          },
          {
            title: t('system:includeSubdepartments'),
            align: 'center',
            width: 125,
            render: (_, row) =>
              row.subjectType === 'dept' ? (
                <Switch
                  aria-label={t('system:includeSubdepartments')}
                  checked={row.includeChildren}
                  onChange={(includeChildren) => update(row.key, { includeChildren })}
                />
              ) : (
                '-'
              ),
          },
          {
            title: t('system:validUntil'),
            align: 'center',
            width: 310,
            render: (_, row) => (
              <BusinessDateTimePicker
                value={row.expireTime}
                label={t('system:validUntilLeaveEmptyForNoExpiry')}
                onChange={(expireTime) => update(row.key, { expireTime })}
              />
            ),
          },
          {
            className: 'ruoyi-actions-cell',
            title: t('common:actions'),
            align: 'center',
            width: 70,
            render: (_, row) => (
              <Tooltip title={t('common:delete')}>
                <TableAction
                  iconOnly={true}
                  tone="danger"
                  symbol="Delete"
                  aria-label={t('file:removeAuthorization')}
                  onClick={() =>
                    setEntries((rows) => rows.filter((entry) => entry.key !== row.key))
                  }
                />
              </Tooltip>
            ),
          },
        ]}
      />
    </Drawer>
  )
}
