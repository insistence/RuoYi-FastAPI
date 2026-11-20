import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import CodePreview from '@/views/tool/gen/CodePreview'
import { copyText } from '@/directive/common/copyText'
import { i18n } from '@/i18n'

vi.mock('@/directive/common/copyText', () => ({ copyText: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/plugins/modal', () => ({ message: { success: vi.fn(), error: vi.fn() } }))

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})
afterAll(() => vi.unstubAllGlobals())

test('same-name locale JSON files have distinct full-path tabs and preserve the selected content', async () => {
  await act(() => i18n.setPreference('zh-CN'))
  const chinesePath = 'react/locales/zh-CN/example.json'
  const englishPath = 'react/locales/en-US/example.json'
  const chinese = '{"name":"名称"}'
  const english = '{"name":"Name"}'
  render(
    <CodePreview
      preview={{
        'python/do.py.jinja2': 'class Example: pass',
        [`${chinesePath}.jinja2`]: chinese,
        [`${englishPath}.jinja2`]: english,
      }}
      onClose={() => {}}
    />
  )
  expect(screen.getByRole('tab', { name: 'do.py', selected: true })).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: chinesePath, exact: true }))
  expect(screen.getByRole('tabpanel').textContent).toContain(chinese)
  fireEvent.click(screen.getByRole('tab', { name: englishPath, exact: true }))
  expect(screen.getByRole('tabpanel').textContent).toContain(english)
  fireEvent.click(screen.getByRole('button', { name: /复制$/ }))
  await waitFor(() => expect(copyText).toHaveBeenCalledWith(english))
})
