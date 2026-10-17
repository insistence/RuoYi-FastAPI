import '@/assets/styles/components.css'
import { Button, Dropdown } from 'antd'
import { FontSizeOutlined } from '@ant-design/icons'
import useSettingsStore from '@/store/modules/settings'
export default function SizeSelect() {
  const { size, update } = useSettingsStore()
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectedKeys: [size],
        items: [
          { key: 'large', label: '较大' },
          { key: 'middle', label: '默认' },
          { key: 'small', label: '稍小' },
        ],
        onClick: ({ key }) => update({ size: key }),
      }}
    >
      <Button
        className="header-icon-button"
        type="text"
        aria-label="组件大小"
        icon={<FontSizeOutlined />}
      />
    </Dropdown>
  )
}
