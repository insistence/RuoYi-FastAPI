import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { renderDialogFooter } from '@/components/DialogFooter'
import './style.css'
import { useEffect, useRef, useState } from 'react'
import { Form, Input, Modal, Select, Switch, TreeSelect } from 'antd'
import { getFileAclDeptTree, searchFileAclSubjects, transferFile } from '@/api/system/file'
import { message } from '@/plugins/modal'

export default function FileTransferDialog({ files, onClose, onSuccess }) {
  useI18n()

  const [form] = Form.useForm(),
    [users, setUsers] = useState([]),
    [depts, setDepts] = useState([]),
    [searching, setSearching] = useState(false),
    [saving, setSaving] = useState(false),
    sequence = useRef(0)
  useLocalizedFormErrors(form)
  const retainUploaderAccess = Form.useWatch('retainUploaderAccess', form)
  async function search(keyword) {
    const version = ++sequence.current
    setSearching(true)
    try {
      const result = await searchFileAclSubjects({
        subjectType: 'user',
        keyword,
      })
      if (version === sequence.current) setUsers(result.data || [])
    } catch {
    } finally {
      if (version === sequence.current) setSearching(false)
    }
  }
  useEffect(() => {
    if (!files) return
    form.resetFields()
    form.setFieldsValue({ retainUploaderAccess: true })
    void search('')
    getFileAclDeptTree()
      .then((result) => setDepts(result.data || []))
      .catch(() => {})
  }, [files, form])
  async function save() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await transferFile(
        files.map((row) => row.fileId),
        values
      )
      message.success(t('file:transfer.filesTransferredSuccessfully'))
      onClose()
      onSuccess()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      footer={renderDialogFooter}
      width="620px"
      className="file-dialog "
      title={t('file:transferFilesValue', {
        arg0:
          files?.length === 1
            ? files[0].originalName
            : t('file:transfer.valueFiles', { arg0: files?.length || 0 }),
      })}
      open={!!files}
      onCancel={onClose}
      onOk={save}
      confirmLoading={saving}
      forceRender
    >
      <Form
        name="src-views-system-file-components-FileTransferDialog-jsx-editor-10"
        className="ruoyi-dialog-form"
        colon={false}
        wrapperCol={{ flex: '1 1 0' }}
        labelCol={{ flex: '100px' }}
        form={form}
        layout="horizontal"
      >
        <Form.Item
          name="ownerUserId"
          label={t('file:shared.newOwner')}
          rules={[{ required: true, message: t('file:transfer.selectANewOwner') }]}
        >
          <Select
            allowClear
            placeholder={t('file:transfer.searchByUsername')}
            showSearch
            filterOption={false}
            loading={searching}
            onSearch={search}
            options={users.map((row) => ({
              value: row.subjectId,
              label: row.subjectName,
            }))}
            onChange={(id) => {
              const user = users.find((row) => row.subjectId === id)
              if (user?.deptId) form.setFieldValue('deptId', user.deptId)
            }}
          />
        </Form.Item>
        <Form.Item
          name="deptId"
          label={t('system:user.department')}
          rules={[{ required: true, message: t('file:shared.selectADepartment') }]}
        >
          <TreeSelect
            allowClear
            placeholder={t('file:shared.selectADepartment')}
            showSearch
            treeNodeFilterProp="label"
            treeData={depts}
            fieldNames={{ label: 'label', value: 'id', children: 'children' }}
          />
        </Form.Item>
        <Form.Item label={t('file:shared.uploaderPermissions')}>
          <div className="file-transfer-permission">
            <span className={!retainUploaderAccess ? 'is-active' : ''}>
              {t('file:transfer.remove')}
            </span>
            <Form.Item
              name="retainUploaderAccess"
              valuePropName="checked"
              noStyle
            >
              <Switch aria-label={t('file:retainUploaderPermissions')} />
            </Form.Item>
            <span className={retainUploaderAccess ? 'is-active' : ''}>
              {t('file:transfer.retain')}
            </span>
          </div>
          <div className="file-form-tip">
            {retainUploaderAccess
              ? t('file:theOriginalUploaderRetainsBuiltInDownloadAccessA')
              : t('file:theOriginalUploaderNoLongerReceivesDownloadAccessThrough')}
          </div>
        </Form.Item>
        <Form.Item
          name="reason"
          label={t('file:transfer.transferReason')}
          rules={[
            { required: true, whitespace: true, message: t('file:transfer.enterATransferReason') },
          ]}
        >
          <Input.TextArea
            placeholder={t('file:transfer.enterATransferReason')}
            rows={3}
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
