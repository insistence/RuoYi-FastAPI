import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useEffect, useState } from 'react'
import { CopyOutlined } from '@ant-design/icons'
import { Button, Modal, Tabs } from 'antd'
import { message } from '@/plugins/modal'
import { copyText } from '@/directive/common/copyText'

const fileName = (path) => path.slice(path.lastIndexOf('/') + 1).replace(/\.jinja2$/, '')
const defaultFile = (files) => files.find((path) => fileName(path) === 'do.py') || files[0]

function previewFileLabel(path) {
  const filename = path.replace(/\.jinja2$/, '')
  if (filename.endsWith('.po')) {
    return filename.replace(/^backend\/i18n\/catalogs\/([^/]+)\/LC_MESSAGES\//, '$1/')
  }
  return filename.endsWith('.json') ? filename : fileName(path)
}

export default function CodePreview({ preview, onClose }) {
  useI18n()

  const files = Object.keys(preview || {})
  const [activeFile, setActiveFile] = useState(() => defaultFile(files))
  useEffect(() => {
    setActiveFile(defaultFile(Object.keys(preview || {})))
  }, [preview])

  async function copy(content) {
    try {
      await copyText(content)
      message.success(t('tool:copiedSuccessfully'))
    } catch {
      message.error(t('common:copyFailedPleaseCopyManually'))
    }
  }

  return (
    <Modal
      title={t('tool:codePreview')}
      className="gen-preview"
      open={!!preview}
      onCancel={onClose}
      footer={null}
      width="80%"
      destroyOnHidden
    >
      {/* 弹窗外层禁用指针事件，正文区会裁切溢出内容，菜单挂在两者之间的内容容器。 */}
      <Tabs
        activeKey={activeFile}
        onChange={setActiveFile}
        more={{ trigger: 'click' }}
        getPopupContainer={(trigger) => trigger.closest('.ant-modal-container')}
        items={files.map((path) => ({
          key: path,
          label: previewFileLabel(path),
          children: (
            <>
              <Button
                className="gen-copy"
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copy(preview[path])}
              >
                {t('common:copy')}
              </Button>
              <pre className="gen-preview-code">{preview[path]}</pre>
            </>
          ),
        }))}
      />
    </Modal>
  )
}
