import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Upload } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import request from '@/utils/request'
import download from '@/plugins/download'
import { message } from '@/plugins/modal'
const base = import.meta.env.VITE_APP_BASE_API
const publicUrl = (url) =>
  /^https?:\/\//i.test(url) || url.startsWith(base + '/') ? url : base + url
function normalize(value) {
  return (Array.isArray(value) ? value : value ? String(value).split(',') : []).map((item, i) => {
    const file = typeof item === 'string' ? { url: item, name: item.split('/').pop() } : item
    return {
      ...file,
      uid: file.uid || `saved-${i}`,
      status: 'done',
      rawUrl: file.url,
      url: publicUrl(file.url),
    }
  })
}
export default function FileUpload({
  value,
  onChange,
  action = '/common/upload',
  isPrivate = false,
  data = {},
  limit = 5,
  fileSize = 5,
  fileType = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'pdf'],
  isShowTip = true,
  disabled = false,
  drag = true,
  image = false,
}) {
  useI18n()

  const [files, setFiles] = useState(() => normalize(value))
  const current = useRef(files)
  const emitted = useRef(value)
  const [preview, setPreview] = useState('')
  const dragIndex = useRef(null)
  useEffect(() => {
    if (value !== emitted.current) {
      current.current = normalize(value)
      setFiles(current.current)
      emitted.current = value
    }
  }, [value])
  function update(next) {
    current.current = next
    setFiles(next)
    const result = next
      .filter((f) => f.status === 'done')
      .map((f) => f.rawUrl)
      .join(',')
    emitted.current = result
    onChange?.(result)
  }
  function upload({ file, onSuccess, onError }) {
    const controller = new AbortController()
    const body = new FormData()
    body.append('file', file)
    Object.entries(data).forEach(([key, value]) => body.append(key, value))
    request({
      url: isPrivate && action === '/common/upload' ? '/common/files/upload' : action,
      method: 'post',
      data: body,
      signal: controller.signal,
      headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false },
    })
      .then((result) => {
        const source = result.data || result
        const url = source.fileName || source.url || source.downloadUrl
        if (!url) throw new Error(t('file:theUploadResponseIsMissingAFileUrl'))
        onSuccess({ ...source, url })
      })
      .catch(onError)
    return { abort: () => controller.abort() }
  }
  function changed({ file, fileList }) {
    const next = fileList.map((item) =>
      item.response
        ? {
            ...item,
            status: 'done',
            rawUrl: item.response.url,
            url: publicUrl(item.response.url),
            name: item.response.originalFilename || item.name,
          }
        : item
    )
    if (file.status === 'error') message.error(t('file:failedToUploadValue', { name: file.name }))
    update(next)
  }
  return (
    <div className={'ruoyi-upload' + (image ? ' is-image' : '')}>
      <Upload
        multiple
        disabled={disabled}
        accept={fileType?.map((t) => `.${t}`).join(',')}
        listType={image ? 'picture-card' : 'text'}
        fileList={files}
        customRequest={upload}
        onChange={changed}
        onPreview={(file) =>
          image
            ? setPreview(file.url)
            : file.rawUrl?.startsWith('/common/files/') ||
                file.rawUrl?.startsWith('/system/file/download/')
              ? download.file(file.rawUrl)
              : window.open(file.url, '_blank', 'noopener,noreferrer')
        }
        showUploadList={{ showRemoveIcon: !disabled }}
        beforeUpload={(file, batch) => {
          const ext = file.name.split('.').pop().toLowerCase()
          if (fileType?.length && !fileType.includes(ext)) {
            message.error(t('file:uploadAFileInValueFormat', { arg0: fileType.join('/') }))
            return Upload.LIST_IGNORE
          }
          if (fileSize && file.size > fileSize * 1024 * 1024) {
            message.error(t('file:fileSizeCannotExceedValueMb', { fileSize }))
            return Upload.LIST_IGNORE
          }
          if (current.current.length + batch.indexOf(file) >= limit) {
            message.warning(t('file:uploadUpToValueFiles', { limit }))
            return Upload.LIST_IGNORE
          }
          if (file.name.includes(',')) {
            message.error(t('file:fileNamesMustNotContainCommas'))
            return Upload.LIST_IGNORE
          }
          return true
        }}
        itemRender={(node, file, list) => (
          <div
            className="upload-file-item"
            draggable={drag && !disabled && file.status === 'done'}
            onDragStart={() => {
              dragIndex.current = list.findIndex((f) => f.uid === file.uid)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const from = dragIndex.current,
                to = list.findIndex((f) => f.uid === file.uid)
              if (from === null || from === to) return
              const next = [...current.current]
              next.splice(to, 0, next.splice(from, 1)[0])
              update(next)
              dragIndex.current = null
            }}
          >
            {node}
          </div>
        )}
      >
        {!disabled &&
          files.length < limit &&
          (image ? (
            <PlusOutlined />
          ) : (
            <Button icon={<UploadOutlined />}>{t('file:upload.select')}</Button>
          ))}
      </Upload>
      {isShowTip && !disabled && (
        <small>
          {t('file:uploadFilesNoLargerThan')} {fileSize} {t('file:mbIn')} {fileType?.join('/')}{' '}
          {t('file:format')}
          {image ? t('file:image') : t('file:file')}
        </small>
      )}
      {image && (
        <Modal
          title={t('common:preview')}
          width={800}
          open={!!preview}
          onCancel={() => setPreview('')}
          footer={null}
        >
          <img
            src={preview}
            alt={t('file:imagePreview')}
            style={{ display: 'block', maxWidth: '100%', margin: '0 auto' }}
          />
        </Modal>
      )}
    </div>
  )
}
