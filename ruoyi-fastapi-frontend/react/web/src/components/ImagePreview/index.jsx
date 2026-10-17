import '@/assets/styles/components.css'
import { Image, Space } from 'antd'
export default function ImagePreview({ src, width = 50, height = 50 }) {
  const urls = (Array.isArray(src) ? src : String(src || '').split(','))
    .filter(Boolean)
    .map((url) => (/^https?:\/\//.test(url) ? url : import.meta.env.VITE_APP_BASE_API + url))
  return (
    <Image.PreviewGroup>
      <Space
        wrap
        className="image-preview"
      >
        {urls.map((url) => (
          <Image
            key={url}
            src={url}
            width={width}
            height={height}
            style={{ objectFit: 'cover' }}
          />
        ))}
      </Space>
    </Image.PreviewGroup>
  )
}
