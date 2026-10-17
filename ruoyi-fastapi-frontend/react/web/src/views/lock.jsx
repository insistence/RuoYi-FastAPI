import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { unlockScreen } from '@/api/login'
import { getToken } from '@/utils/auth'
import { formatBusinessTime } from '@/utils/time'
import useUserStore from '@/store/modules/user'
import useLockStore from '@/store/modules/lock'
import defaultAvatar from '@/assets/images/profile.jpg'
import './lock.css'

export default function LockScreen() {
  const user = useUserStore(),
    lock = useLockStore(),
    navigate = useNavigate()
  const [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [now, setNow] = useState(new Date())
  const canvas = useRef(),
    input = useRef(),
    pending = useRef(false)
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
      setError('请输入密码')
      input.current?.focus()
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await unlockScreen(password)
      const path = lock.lockPath
      lock.unlockScreen()
      navigate(path, { replace: true })
    } catch (reason) {
      setError(reason.message || '解锁失败')
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
        to="/index"
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
      <div className="lock-date">{formatBusinessTime(now, 'YYYY年M月D日 星期{a}')}</div>
      <section
        className="lock-card"
        aria-label="屏幕已锁定"
      >
        <div className="avatar-wrap">
          <img
            src={user.avatar || defaultAvatar}
            className="lock-avatar"
            alt="用户头像"
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
        <p className="lock-hint">系统已锁定，请输入密码解锁</p>
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
            aria-label="登录密码"
            aria-invalid={!!error}
            placeholder="请输入登录密码"
            className="lock-input"
            autoComplete="current-password"
          />
          <button
            className="unlock-btn"
            type="submit"
            disabled={busy}
            aria-label="解锁"
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
            退出重新登录
          </button>
        </div>
      </section>
    </main>
  )
}
