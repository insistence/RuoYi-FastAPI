import { Button, Input } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import './style.css'
export default function StringListInput({
  value = [],
  onChange,
  placeholder = '',
  addText = '添加一项',
}) {
  const items = value.length ? value : ['']
  function update(index, next) {
    const list = [...items]
    list[index] = next
    onChange?.(list)
  }
  return (
    <div className="oauth-string-list">
      {items.map((item, index) => (
        <div
          className="oauth-string-row"
          key={index}
        >
          <Input
            value={item}
            placeholder={placeholder}
            onChange={(event) => update(index, event.target.value)}
            onPressEnter={(event) => {
              event.preventDefault()
              if (item.trim())
                onChange?.([...items.slice(0, index + 1), '', ...items.slice(index + 1)])
            }}
          />
          <Button
            danger
            type="text"
            aria-label={`删除第 ${index + 1} 项`}
            icon={<DeleteOutlined />}
            onClick={() => onChange?.(items.filter((_, i) => i !== index))}
          />
        </div>
      ))}
      <Button
        className="oauth-add-row"
        type="link"
        icon={<PlusOutlined />}
        onClick={() => onChange?.([...items, ''])}
      >
        {addText}
      </Button>
    </div>
  )
}
