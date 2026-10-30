import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import './style.css'
import { Modal } from 'antd'
import IconSelect from '@/components/IconSelect'
export default function IconsDialog({ open, value, onClose, onSelect }) {
  useI18n()

  return (
    <Modal
      width="980px"
      className="builder-icons-dialog"
      title={t('tool:chooseIcon')}
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <IconSelect
        inline
        placeholder={t('common:enterAnIconName')}
        value={value}
        style={{ width: '100%' }}
        onChange={(value) => {
          onSelect(value || '')
          onClose()
        }}
      />
    </Modal>
  )
}
