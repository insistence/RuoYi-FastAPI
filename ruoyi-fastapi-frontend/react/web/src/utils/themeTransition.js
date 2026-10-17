import { flushSync } from 'react-dom'

let activeTransition

export async function changeTheme(event, wasDark, update) {
  activeTransition?.skipTransition()
  const apply = () => flushSync(() => update({ dark: !wasDark }))
  if (
    !document.startViewTransition ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    apply()
    return
  }
  const pointer = event && (event.clientX !== 0 || event.clientY !== 0)
  const x = pointer ? event.clientX : window.innerWidth / 2
  const y = pointer ? event.clientY : window.innerHeight / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  let committed = false
  let transition
  try {
    transition = document.startViewTransition(() => {
      apply()
      committed = true
    })
  } catch {
    if (!committed) apply()
    return
  }
  activeTransition = transition
  try {
    await transition.ready
    const clips = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
    await document.documentElement.animate(
      { clipPath: wasDark ? clips : clips.toReversed() },
      {
        duration: 650,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
        pseudoElement: wasDark ? '::view-transition-new(root)' : '::view-transition-old(root)',
      }
    ).finished
  } catch {
    // A skipped transition still commits its update; never toggle a second time.
    await transition.updateCallbackDone.catch(() => {
      if (!committed) apply()
    })
  } finally {
    if (activeTransition === transition) activeTransition = undefined
  }
}
