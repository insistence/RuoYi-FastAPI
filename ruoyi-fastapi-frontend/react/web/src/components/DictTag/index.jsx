import '@/assets/styles/components.css'
import { Tag } from 'antd'
export default function DictTag({ options, value }) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',')
  return values.map((value) => {
    const option = options.find((item) => String(item.value) === String(value))
    return (
      <Tag
        className="dict-tag"
        key={value}
        color={
          {
            success: 'success',
            danger: 'error',
            warning: 'warning',
            primary: 'blue',
          }[option?.elTagType]
        }
      >
        {option?.label || value}
      </Tag>
    )
  })
}
