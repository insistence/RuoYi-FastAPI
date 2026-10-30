import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import '@/assets/styles/components.css'
import { Button, Dropdown } from 'antd'
import { FontSizeOutlined } from '@ant-design/icons'
import useSettingsStore from '@/store/modules/settings'
export default function SizeSelect() {
  useI18n()

  const { size, update } = useSettingsStore()
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectedKeys: [size],
        items: [
          { key: 'large', label: t('layout:size.large') },
          { key: 'middle', label: t('layout:size.default') },
          { key: 'small', label: t('layout:size.small') },
        ],
        onClick: ({ key }) => update({ size: key }),
      }}
    >
      <Button
        className="header-icon-button"
        type="text"
        aria-label={t('common:componentSize')}
        icon={<FontSizeOutlined />}
      />
    </Dropdown>
  )
}
