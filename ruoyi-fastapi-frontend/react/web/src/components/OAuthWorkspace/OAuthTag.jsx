import { Tag } from 'antd'
import './entities.css'

export default function OAuthTag({
  type = 'primary',
  effect = 'light',
  size,
  className = '',
  ...props
}) {
  return (
    <Tag
      {...props}
      className={`oauth-tag oauth-tag--${type} oauth-tag--${effect}${size === 'small' ? ' oauth-tag--small' : ''} ${className}`}
    />
  )
}
