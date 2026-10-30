import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import '@/assets/styles/components.css'
import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons'
import { message } from '@/plugins/modal'
export default function Screenfull() {
  useI18n()

  const [active, setActive] = useState(!!document.fullscreenElement)
  useEffect(() => {
    const update = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  return (
    <Button
      className="header-icon-button"
      aria-label={active ? t('common:exitFullScreen') : t('common:fullScreen')}
      type="text"
      icon={active ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
      onClick={async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen()
          else if (document.documentElement.requestFullscreen)
            await document.documentElement.requestFullscreen()
          else message.warning(t('common:thisBrowserDoesNotSupportFullScreen'))
        } catch {
          message.warning(t('common:unableToChangeFullScreenModeCheckYourBrowser'))
        }
      }}
    />
  )
}
