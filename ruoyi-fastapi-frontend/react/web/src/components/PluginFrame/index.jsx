import { useLocalizedText } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { i18n, resolveRouteTitle, t } from '@/i18n'
import '@/assets/styles/components.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button, Result, Spin } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import request from '@/utils/request'
import { getDisplayTimezone } from '@/utils/time'
import { tansParams } from '@/utils/ruoyi'
import { createPluginSseTransport } from '@/utils/pluginSse'
import {
  ensureTransportCryptoPolicyLoaded,
  shouldEncryptRequest,
} from '@/utils/transportCryptoPolicy'
import {
  createPluginHostBridge,
  normalizePluginBase,
  validatePluginId,
  validatePluginRoute,
  validatePluginSession,
} from '@/utils/pluginBridge'

export default function PluginFrame({ route }) {
  const { locale } = useI18n()

  const token = useUserStore((state) => state.token),
    timeZone = useUserStore((state) => state.timeZone),
    settings = useSettingsStore(),
    location = useLocation(),
    navigate = useNavigate()
  const [frame, setFrame] = useState(),
    [loading, setLoading] = useState(false),
    [error, setError] = useLocalizedText(''),
    [revision, setRevision] = useState(0),
    iframe = useRef(),
    runtime = useRef({
      generation: 0,
      active: false,
      bridge: null,
      session: null,
      controller: null,
      timers: [],
    }),
    context = useRef()
  const title = String(resolveRouteTitle(route) || t('common:pluginApplication')),
    pluginId = route.meta?.pluginId
  function currentRoute() {
    try {
      return validatePluginRoute(
        new URLSearchParams(context.current.location.search).get('pluginRoute') || '/'
      )
    } catch {
      return '/'
    }
  }
  context.current = {
    location,
    navigate,
    preferences: {
      theme: {
        mode: settings.dark ? 'dark' : 'light',
        primary: settings.colorPrimary,
      },
      language: locale,
      timeZone: getDisplayTimezone(),
    },
  }
  function cleanup(logout = false) {
    const current = runtime.current
    current.generation++
    current.timers.forEach(clearTimeout)
    current.timers = []
    current.controller?.abort()
    current.controller = null
    current.bridge?.destroy({ logout })
    current.bridge = null
    current.session = null
    setFrame(undefined)
    setLoading(false)
  }
  function fail(reason) {
    cleanup()
    setError(reason)
  }
  function schedule(ticket) {
    const current = runtime.current
    current.timers.forEach(clearTimeout)
    const remaining = current.session.expiresAt - Date.now()
    current.timers = [
      setTimeout(
        () => {
          if (ticket === current.generation)
            fail((t) => t('common:thePluginSessionHasExpiredReloadThePage'))
        },
        Math.max(0, remaining)
      ),
      setTimeout(
        () => {
          if (ticket === current.generation) loadSession(ticket, true)
        },
        Math.max(500, remaining - Math.min(30000, remaining / 5))
      ),
    ]
  }
  async function loadSession(ticket, renew = false) {
    const current = runtime.current,
      controller = new AbortController()
    current.controller = controller
    try {
      const id = validatePluginId(pluginId),
        base = normalizePluginBase(import.meta.env.VITE_APP_PLUGIN_BASE || '')
      const response = await request({
        url: `${base}/plugin/runtime/${id}/session`,
        baseURL: '',
        method: 'post',
        headers: { repeatSubmit: false },
        signal: controller.signal,
        skipErrorMessage: true,
        pluginBridge: true,
      })
      if (
        !current.active ||
        ticket !== current.generation ||
        !useUserStore.getState().token ||
        controller.signal.aborted
      )
        return
      const next = validatePluginSession(response.data, id, base)
      if (renew) {
        if (!current.session || current.session.expiresAt <= Date.now()) throw new Error('expired')
        current.bridge?.setSession(next)
        current.session = next
      } else {
        current.session = next
        setFrame({ src: next.uiBase, ticket, pluginId: id })
      }
      schedule(ticket)
    } catch {
      if (ticket === current.generation && !controller.signal.aborted)
        fail((t) =>
          renew
            ? t('common:failedToRenewThePluginSessionReloadThePage')
            : t('common:unableToCreateAPluginSessionCheckYourPermissions')
        )
    } finally {
      if (current.controller === controller) current.controller = null
    }
  }
  useEffect(() => {
    const current = runtime.current
    current.active = true
    cleanup(!token)
    setError('')
    if (!token) setError((t) => t('common:yourSessionHasExpiredSignInAgain'))
    else {
      setLoading(true)
      loadSession(current.generation)
    }
    const observer = new MutationObserver(() => {
      context.current.preferences.language = document.documentElement.lang || 'zh-CN'
      current.bridge?.updatePreferences()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    })
    return () => {
      current.active = false
      observer.disconnect()
      cleanup(!useUserStore.getState().token)
    }
  }, [pluginId, token, revision])
  useLayoutEffect(() => {
    if (!frame || !iframe.current) return
    const current = runtime.current,
      { ticket } = frame
    if (ticket !== current.generation) return
    current.bridge = createPluginHostBridge({
      pluginId: frame.pluginId,
      session: current.session,
      getTarget: () => iframe.current?.contentWindow,
      request,
      stream: createPluginSseTransport({
        loadPolicy: ensureTransportCryptoPolicyLoaded,
        shouldEncryptRequest,
        serializeParams: tansParams,
        getTimezone: getDisplayTimezone,
        getLocaleHeaders: () => i18n.headers,
      }),
      getContext: () => ({
        ...context.current.preferences,
        route: currentRoute(),
      }),
      onReady: () => {
        if (ticket !== current.generation) return
        clearTimeout(handshake)
        setLoading(false)
      },
      onDisconnect: () => fail((t) => t('common:thePluginIsCurrentlyUnavailable')),
      onRoute: (pluginRoute) => {
        if (ticket !== current.generation || pluginRoute === currentRoute()) return
        const query = new URLSearchParams(context.current.location.search)
        query.set('pluginRoute', pluginRoute)
        context.current.navigate(
          {
            pathname: context.current.location.pathname,
            search: query.toString(),
          },
          { replace: true }
        )
      },
    })
    const handshake = setTimeout(() => {
      if (ticket === current.generation)
        fail((t) => t('common:pluginConnectionTimedOutReloadThePage'))
    }, 15000)
    return () => {
      clearTimeout(handshake)
      current.bridge?.destroy()
      current.bridge = null
    }
  }, [frame])
  useEffect(() => {
    runtime.current.bridge?.updatePreferences()
  }, [settings.dark, settings.colorPrimary, timeZone, locale])
  useEffect(() => {
    runtime.current.bridge?.updateRoute(currentRoute())
  }, [location.search])
  return (
    <section
      className="plugin-frame"
      aria-busy={loading}
    >
      {error ? (
        <Result
          status="warning"
          title={t('common:thePluginIsCurrentlyUnavailable')}
          subTitle={error}
          extra={
            <Button
              type="primary"
              disabled={!token}
              onClick={() => setRevision((value) => value + 1)}
            >
              {t('common:reload')}
            </Button>
          }
        />
      ) : (
        <Spin
          spinning={loading}
          description={t('common:loadingPlugin')}
        >
          <div className="plugin-frame-content">
            <div className="plugin-frame-toolbar">
              <span>{title}</span>
              <Button
                size="small"
                disabled={loading || !frame}
                onClick={() => runtime.current.bridge?.refresh()}
              >
                {t('common:refreshPlugin')}
              </Button>
            </div>
            {frame && (
              <iframe
                key={frame.ticket}
                ref={iframe}
                src={frame.src}
                title={title}
                referrerPolicy="same-origin"
                onError={() => fail((t) => t('common:failedToLoadThePluginPagePleaseTryAgain'))}
              />
            )}
          </div>
        </Spin>
      )}
    </section>
  )
}
