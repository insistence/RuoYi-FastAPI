import { useState } from 'react'
import { Spin } from 'antd'
export default function IFrame({ src, title = '内嵌页面' }) {
  const [loading, setLoading] = useState(true)
  return (
    <Spin spinning={loading}>
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoading(false)}
        style={{ width: '100%', height: 'calc(100vh - 145px)', border: 0 }}
      />
    </Spin>
  )
}
