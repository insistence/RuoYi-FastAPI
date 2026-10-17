const listeners = new Set()
const pending = new Set()
let progress = 0
let timer
let hideTimer
const emit = () => listeners.forEach((listener) => listener())

export const loadingProgress = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => progress,
}

export function beginProgress() {
  const token = Symbol()
  pending.add(token)
  clearTimeout(hideTimer)
  if (!progress || progress === 1) progress = 0.08
  emit()
  if (!timer)
    timer = setInterval(() => {
      progress += (0.94 - progress) * 0.12
      emit()
    }, 200)
  return () => {
    if (!pending.delete(token) || pending.size) return
    clearInterval(timer)
    timer = undefined
    progress = 1
    emit()
    hideTimer = setTimeout(() => {
      progress = 0
      emit()
    }, 300)
  }
}
