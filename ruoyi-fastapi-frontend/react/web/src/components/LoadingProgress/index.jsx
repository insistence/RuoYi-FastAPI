import { useEffect, useSyncExternalStore } from 'react'
import { Spin } from 'antd'
import { beginProgress, loadingProgress } from '@/utils/loadingProgress'
import './style.css'

export function PageLoading({ description = '正在加载页面', className = '', ...props }) {
  useEffect(() => beginProgress(), [])
  return (
    <div
      className={`page-loading ${className}`}
      role="status"
      aria-label={description}
    >
      <Spin {...props} />
    </div>
  )
}

export default function LoadingProgress({ router }) {
  const progress = useSyncExternalStore(loadingProgress.subscribe, loadingProgress.getSnapshot)
  useEffect(() => {
    let key
    let finish
    let timeout
    const update = (state) => {
      const next = state.navigation.location?.key || state.location.key
      if (next !== key) {
        key = next
        const previous = finish
        finish = beginProgress()
        previous?.()
      }
      clearTimeout(timeout)
      if (state.navigation.state === 'idle')
        timeout = setTimeout(() => {
          finish?.()
          finish = undefined
        }, 180)
    }
    update(router.state)
    const unsubscribe = router.subscribe(update)
    return () => {
      unsubscribe()
      clearTimeout(timeout)
      finish?.()
    }
  }, [router])
  return progress > 0 ? (
    <div
      className={`route-progress${progress === 1 ? ' is-complete' : ''}`}
      aria-hidden="true"
    >
      <div style={{ transform: `translateX(${(progress - 1) * 100}%)` }}>
        <span />
      </div>
    </div>
  ) : null
}
