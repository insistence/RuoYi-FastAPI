import { it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import PluginFrame from '@/components/PluginFrame'
import request from '@/utils/request'
import useUserStore from '@/store/modules/user'
vi.mock('@/utils/request', () => ({ default: vi.fn(() => new Promise(() => {})) }))
vi.mock('@/store/modules/user', async () => ({
  default: (await import('zustand')).create(() => ({
    token: 'host-session',
    timeZone: 'Asia/Shanghai',
  })),
}))
vi.mock('@/store/modules/settings', () => ({
  default: () => ({ dark: false, colorPrimary: '#1677ff' }),
}))
vi.mock('@/utils/time', () => ({ getDisplayTimezone: () => 'Asia/Shanghai' }))
vi.mock('@/utils/ruoyi', () => ({ tansParams: () => '' }))
vi.mock('@/utils/transportCryptoPolicy', () => ({
  ensureTransportCryptoPolicyLoaded: vi.fn(),
  shouldEncryptRequest: () => false,
}))
it('查询参数和菜单对象重建不重新开插件会话，插件或令牌变化会取消并重建', async () => {
  let navigate
  function Scene({ pluginId = 'demo', title = '演示插件' }) {
    navigate = useNavigate()
    return <PluginFrame route={{ meta: { pluginId, title } }} />
  }
  const view = render(
    <MemoryRouter initialEntries={['/plugin?pluginRoute=/first']}>
      <Scene />
    </MemoryRouter>
  )
  expect(request).toHaveBeenCalledTimes(1)
  await act(async () => navigate('/plugin?pluginRoute=/second'))
  expect(request).toHaveBeenCalledTimes(1)
  view.rerender(
    <MemoryRouter>
      <Scene title="更新标题" />
    </MemoryRouter>
  )
  expect(request).toHaveBeenCalledTimes(1)
  view.rerender(
    <MemoryRouter>
      <Scene pluginId="other" />
    </MemoryRouter>
  )
  expect(request.mock.calls[0][0].signal.aborted).toBe(true)
  expect(request).toHaveBeenCalledTimes(2)
  await act(async () => useUserStore.setState({ token: 'new-session' }))
  expect(request.mock.calls[1][0].signal.aborted).toBe(true)
  expect(request).toHaveBeenCalledTimes(3)
  view.unmount()
  expect(request.mock.calls[2][0].signal.aborted).toBe(true)
})
