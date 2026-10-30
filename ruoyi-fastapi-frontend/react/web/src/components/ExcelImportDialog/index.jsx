import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { renderDialogFooter } from '@/components/DialogFooter'
import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Modal, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import request, { download } from '@/utils/request'
import { message } from '@/plugins/modal'
export default function ExcelImportDialog({
  open,
  onClose,
  onSuccess,
  title = t('common:import'),
  width = '400px',
  action,
  templateAction,
  templateFileName = 'template',
  updateSupportLabel = t('common:updateExistingRecords'),
}) {
  useI18n()

  const [files, setFiles] = useState([]),
    [updateSupport, setUpdateSupport] = useState(false),
    [loading, setLoading] = useState(false),
    [result, setResult] = useState('')
  useEffect(() => {
    if (open) {
      setFiles([])
      setUpdateSupport(false)
      setResult('')
    }
  }, [open])
  async function submit() {
    const file = files[0]?.originFileObj || files[0]
    if (!file || !/\.xlsx?$/i.test(file.name))
      return message.error(t('common:chooseAnXlsOrXlsxFile'))
    setLoading(true)
    try {
      const data = new FormData()
      data.append('file', file)
      const response = await request({
        url: action,
        method: 'post',
        params: { updateSupport },
        data,
        headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false },
      })
      setResult(
        String(response.msg || t('common:importCompleted'))
          .replace(/<br\s*\/?\s*>/gi, '\n')
          .replace(/<[^>]*>/g, '')
      )
      onSuccess?.()
    } catch {
    } finally {
      setLoading(false)
    }
  }
  return (
    <Modal
      footer={renderDialogFooter}
      width={width}
      title={title}
      open={open}
      onCancel={loading ? undefined : onClose}
      onOk={result ? onClose : submit}
      okText={result ? t('layout:search.close') : t('common:startImport')}
      confirmLoading={loading}
      cancelButtonProps={{ disabled: loading }}
    >
      {result ? (
        <Alert
          type="success"
          title={t('common:importResults')}
          description={
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: '60vh',
                overflow: 'auto',
              }}
            >
              {result}
            </pre>
          }
        />
      ) : (
        <>
          <Upload.Dragger
            accept=".xls,.xlsx"
            maxCount={1}
            fileList={files}
            disabled={loading}
            beforeUpload={() => false}
            onChange={({ fileList }) => setFiles(fileList)}
          >
            <p>
              <InboxOutlined style={{ fontSize: 40 }} />
            </p>
            <p>{t('common:dragAFileHereOrClickToUpload')}</p>
            <p>{t('common:onlyXlsAndXlsxFilesAreSupported')}</p>
          </Upload.Dragger>
          <p>
            <Checkbox
              checked={updateSupport}
              onChange={(event) => setUpdateSupport(event.target.checked)}
            >
              {updateSupportLabel}
            </Checkbox>
          </p>
          {templateAction && (
            <Button
              type="link"
              onClick={() =>
                download(templateAction, {}, `${templateFileName}_${Date.now()}.xlsx`).catch(
                  () => {}
                )
              }
            >
              {t('common:downloadTemplate')}
            </Button>
          )}
        </>
      )}
    </Modal>
  )
}
