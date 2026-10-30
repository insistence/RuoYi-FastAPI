import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { unlockScreen } from '@/api/login'
import { getToken } from '@/utils/auth'
import { formatBusinessTime, getDisplayTimezone } from '@/utils/time'
import useUserStore from '@/store/modules/user'
import useLockStore from '@/store/modules/lock'
import defaultAvatar from '@/assets/images/profile.jpg'
import './lock.css'

export default function LockScreen() {
  useI18n()

  const user = useUserStore(),
    lock = useLockStore()
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useLocalizedText(''),
    [now, setNow] = useState(new Date())
  const canvas = useRef(),
    input = useRef(),
    pending = useRef(false),
    returnPath = useRef(lock.lockPath)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const element = canvas.current,
      ctx = element?.getContext('2d')
    if (!ctx) return
    let frame
    const resize = () => {
      element.width = window.innerWidth
      element.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * element.width,
      y: Math.random() * element.height,
      r: Math.random() * 2 + 1,
      dx: (Math.random() - 0.5) * 0.6,
      dy: (Math.random() - 0.5) * 0.6,
      alpha: Math.random() * 0.5 + 0.2,
    }))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw = () => {
      ctx.clearRect(0, 0, element.width, element.height)
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`
        ctx.fill()
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0 || p.x > element.width) p.dx *= -1
        if (p.y < 0 || p.y > element.height) p.dy *= -1
      }
      for (let i = 0; i < particles.length; i++)
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i],
            b = particles[j],
            distance = Math.hypot(a.x - b.x, a.y - b.y)
          if (distance < 120) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - distance / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      if (!reducedMotion) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])
  async function unlock(event) {
    event.preventDefault()
    if (pending.current) return
    if (!password) {
      setError((t) => t('authCenter:auth-center.enterYourPassword'))
      input.current?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await unlockScreen(password)
      lock.unlockScreen()
    } catch (reason) {
      setError((t) => reason.message || t('auth:unlockFailed'))
      setPassword('')
      input.current?.focus()
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  if (!getToken())
    return (
      <Navigate
        replace
        to="/login"
      />
    )
  if (!lock.isLock)
    return (
      <Navigate
        replace
        to={returnPath.current}
      />
    )
  return (
    <main className="lock-container">
      <canvas
        ref={canvas}
        className="particle-bg"
        aria-hidden="true"
      />
      <div className="lock-time">{formatBusinessTime(now, 'HH:mm:ss')}</div>
      <div className="lock-date">
        {new Intl.DateTimeFormat(i18n.locale, {
          timeZone: getDisplayTimezone(),
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(now)}
      </div>
      <section
        className="lock-card"
        aria-label={t('auth:screenLocked')}
      >
        <div className="avatar-wrap">
          <img
            src={user.avatar || defaultAvatar}
            className="lock-avatar"
            alt={t('auth:userAvatar')}
            onError={(event) => {
              event.currentTarget.onerror = null
              event.currentTarget.src = defaultAvatar
            }}
          />
          <div
            className="lock-icon"
            aria-hidden="true"
          >
            🔒
          </div>
        </div>
        <div className="lock-username">{user.nickName || user.name}</div>
        <p className="lock-hint">{t('auth:lock.hint')}</p>
        <form
          className="input-wrap"
          onSubmit={unlock}
        >
          <input
            ref={input}
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-label={t('auth:signInPassword')}
            aria-invalid={!!error}
            placeholder={t('auth:lock.password')}
            className="lock-input"
            autoComplete="current-password"
          />
          <button
            className="unlock-btn"
            type="submit"
            disabled={busy}
            aria-label={t('auth:lock.unlock')}
          >
            {busy ? '···' : '→'}
          </button>
        </form>
        {error && (
          <div
            className="error-msg"
            role="alert"
          >
            {error}
          </div>
        )}
        <div className="lock-footer">
          <button
            type="button"
            onClick={async () => {
              await user.logOut()
              lock.unlockScreen()
              navigate('/login', { replace: true })
            }}
          >
            {t('auth:lock.signIn')}
          </button>
        </div>
      </section>
    </main>
  )
}
