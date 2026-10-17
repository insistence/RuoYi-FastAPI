import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

export default function EChart({ option, height = 360, onClick }) {
  const container = useRef(null),
    instance = useRef(null)
  useEffect(() => {
    const chart = echarts.init(container.current)
    instance.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      instance.current = null
    }
  }, [])
  useEffect(() => {
    if (option) instance.current?.setOption(option, true)
  }, [option])
  useEffect(() => {
    const chart = instance.current
    if (onClick) chart?.on('click', onClick)
    return () => {
      if (onClick && !chart?.isDisposed()) chart?.off('click', onClick)
    }
  }, [onClick])
  return (
    <div
      ref={container}
      role="img"
      aria-label={option?.title?.text || '统计图表'}
      style={{ height, width: '100%' }}
    />
  )
}
