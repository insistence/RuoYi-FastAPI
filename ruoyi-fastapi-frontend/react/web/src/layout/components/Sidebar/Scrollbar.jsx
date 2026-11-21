import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

// Keep native scrolling (including keyboard/touch), with an overlay thumb like Vue's el-scrollbar.
export default function SidebarScrollbar({ children }) {
  useI18n()

  const viewport = useRef(null)
  const content = useRef(null)
  const drag = useRef(null)
  const timer = useRef(null)
  const [scrolling, setScrolling] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [thumb, setThumb] = useState({ height: 0, top: 0 })
  const measure = useCallback(() => {
    const element = viewport.current
    if (!element) return
    const trackHeight = Math.max(0, element.clientHeight - 4)
    const maxScroll = element.scrollHeight - element.clientHeight
    const height =
      maxScroll > 0
        ? Math.min(
            trackHeight,
            Math.max(20, (trackHeight * element.clientHeight) / element.scrollHeight)
          )
        : 0
    const top =
      maxScroll > 0
        ? (Math.min(maxScroll, Math.max(0, element.scrollTop)) / maxScroll) * (trackHeight - height)
        : 0
    setThumb((previous) =>
      previous.height === height && previous.top === top ? previous : { height, top }
    )
  }, [])

  useLayoutEffect(() => {
    const observer = new ResizeObserver(measure)
    observer.observe(viewport.current)
    observer.observe(content.current)
    measure()
    return () => {
      observer.disconnect()
      clearTimeout(timer.current)
    }
  }, [measure])

  function onScroll() {
    measure()
    setScrolling(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setScrolling(false), 800)
  }

  function moveThumb(event) {
    if (!drag.current) return
    const element = viewport.current
    const track = event.currentTarget.getBoundingClientRect()
    const travel = track.height - thumb.height
    if (travel <= 0) return
    const top = Math.max(0, Math.min(travel, event.clientY - track.top - drag.current.offset))
    element.scrollTop = (top / travel) * (element.scrollHeight - element.clientHeight)
  }

  function startDrag(event) {
    if (event.button !== 0) return
    event.preventDefault()
    const track = event.currentTarget
    drag.current = {
      offset:
        event.target === track
          ? thumb.height / 2
          : event.clientY - track.getBoundingClientRect().top - thumb.top,
    }
    track.setPointerCapture(event.pointerId)
    setDragging(true)
    moveThumb(event)
  }

  function stopDrag(event) {
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className={`layout-sidebar-scroll${scrolling || dragging ? ' is-scrolling' : ''}`}>
      <div
        ref={viewport}
        className="layout-sidebar-viewport"
        tabIndex={0}
        role="region"
        aria-label={t('layout:sideMenu')}
        onScroll={onScroll}
      >
        <div ref={content}>{children}</div>
      </div>
      {thumb.height > 0 && (
        <div
          className={`layout-sidebar-track${dragging ? ' is-dragging' : ''}`}
          aria-hidden="true"
          onPointerDown={startDrag}
          onPointerMove={moveThumb}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onLostPointerCapture={() => {
            drag.current = null
            setDragging(false)
          }}
        >
          <div
            className="layout-sidebar-thumb"
            style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
          />
        </div>
      )}
    </div>
  )
}
