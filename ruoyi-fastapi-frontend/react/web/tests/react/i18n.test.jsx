import React from 'react'
import { transformWithOxc } from 'vite'
import { Form, Input, Row, Col, Button, Space } from 'antd'
import { useLocalizedFormErrors, useLocalizedText } from '@/i18n/form'
import { useDict, clearDictCache } from '@/utils/dict'
import { getDicts } from '@/api/system/dict/data'
import { makeUpJs } from '@/utils/generator/js'
import { fieldRules } from '@/utils/generator/model'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '@/i18n'
import { useI18n } from '@/i18n/adapter'

vi.mock('@/api/system/dict/data', () => ({ getDicts: vi.fn() }))

afterEach(cleanup)
function Editor() {
  const { t } = useI18n()
  return (
    <label>
      {t('common:login.username')}
      <input
        aria-label="draft"
        defaultValue=""
      />
    </label>
  )
}

test('language changes update React text and html.lang without remounting a draft', async () => {
  i18n.setAccount(null)
  await i18n.setPreference('zh-CN')
  render(
    <I18nextProvider i18n={i18n.engine}>
      <Editor />
    </I18nextProvider>
  )
  const input = screen.getByRole('textbox', { name: 'draft' })
  fireEvent.change(input, { target: { value: 'unsaved input' } })
  await act(() => i18n.setPreference('en-US'))
  expect(screen.getByText('Username')).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'draft' })).toBe(input)
  expect(input.value).toBe('unsaved input')
  expect(document.documentElement.lang).toBe('en-US')
  await act(() => i18n.setPreference('zh-CN'))
})

function ValidationEditor() {
  const { t } = useI18n()
  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const [notice, setNotice] = useLocalizedText('')
  return (
    <Form form={form}>
      <Form.Item
        name="required"
        rules={[{ required: true, message: t('system:dict.nameRequired') }]}
      >
        <Input aria-label="required field" />
      </Form.Item>
      <Form.Item
        name="untouched"
        rules={[{ required: true, message: 'untouched validation' }]}
      >
        <Input aria-label="untouched field" />
      </Form.Item>
      <Form.Item name="draft">
        <Input aria-label="preserved draft" />
      </Form.Item>
      <button
        type="button"
        onClick={() => form.validateFields(['required']).catch(() => {})}
      >
        validate
      </button>
      <button
        type="button"
        onClick={() => setNotice((t) => t('common:edit'))}
      >
        show notice
      </button>
      <output>{notice}</output>
    </Form>
  )
}

test('locale changes refresh shown errors and local dialog text while keeping untouched fields and drafts', async () => {
  await i18n.setPreference('zh-CN')
  render(<ValidationEditor />)
  const draft = screen.getByRole('textbox', { name: 'preserved draft' })
  fireEvent.change(draft, { target: { value: 'unsaved business value' } })
  fireEvent.click(screen.getByRole('button', { name: 'validate' }))
  fireEvent.click(screen.getByRole('button', { name: 'show notice' }))
  expect(await screen.findByText('字典名称不能为空')).toBeTruthy()
  expect(screen.getByText('修改')).toBeTruthy()
  await act(() => i18n.setPreference('en-US'))
  expect(await screen.findByText('Dictionary name is required')).toBeTruthy()
  expect(screen.getByText('Edit')).toBeTruthy()
  expect(screen.queryByText('untouched validation')).toBeNull()
  expect(screen.getByRole('textbox', { name: 'preserved draft' })).toBe(draft)
  expect(draft.value).toBe('unsaved business value')
  await act(() => i18n.setPreference('zh-CN'))
})

function DictionaryReader() {
  const values = useDict('i18n_test_status')
  return (
    <output>
      {values.i18n_test_status.map((item) => `${item.label}:${item.value}`).join(',')}
    </output>
  )
}

test('dictionary labels update from cached maps without another request or changing business values', async () => {
  clearDictCache()
  getDicts.mockResolvedValue({
    data: [{ dictLabel: '启用', dictLabelI18n: { 'en-US': 'Enabled' }, dictValue: '0' }],
  })
  await i18n.setPreference('zh-CN')
  render(<DictionaryReader />)
  expect(await screen.findByText('启用:0')).toBeTruthy()
  await act(() => i18n.setPreference('en-US'))
  expect(await screen.findByText('Enabled:0')).toBeTruthy()
  expect(getDicts).toHaveBeenCalledTimes(1)
  await act(() => i18n.setPreference('zh-CN'))
})

test('exported designer forms translate at runtime and preserve user labels, validation text and drafts', async () => {
  await i18n.setPreference('en-US')
  const fields = [
    {
      tag: 'Input',
      vModel: 'business',
      label: '保留用户标签',
      required: true,
      regList: [{ pattern: '/^ok$/', message: '保留用户提示' }],
    },
    { tag: 'Input', vModel: 'notes', label: '用户备注' },
  ]
  const source = makeUpJs(fields, { formBtns: true, size: 'default' })
  const executable = source
    .replace(/^import[^\n]+\n/gm, '')
    .replace('export default function', 'function')
  const compiled = await transformWithOxc(executable, 'GeneratedForm.jsx', {
    jsx: { runtime: 'classic' },
  })
  const scope = {
    React,
    Form,
    Input,
    Row,
    Col,
    Button,
    Space,
    useI18n,
    useLocalizedFormErrors,
    fieldRules,
  }
  const GeneratedForm = new Function(
    ...Object.keys(scope),
    `${compiled.code}; return GeneratedForm`
  )(...Object.values(scope))
  render(<GeneratedForm />)
  const draft = screen.getByRole('textbox', { name: '用户备注' })
  fireEvent.change(draft, { target: { value: '保留草稿' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  expect(await screen.findByText('Enter 保留用户标签')).toBeTruthy()
  await act(() => i18n.setPreference('zh-CN'))
  expect(await screen.findByText('请填写保留用户标签')).toBeTruthy()
  expect(screen.getByRole('button', { name: /提\s*交/ })).toBeTruthy()
  expect(screen.getByRole('textbox', { name: '用户备注' })).toBe(draft)
  expect(draft.value).toBe('保留草稿')
  fireEvent.change(screen.getByRole('textbox', { name: '保留用户标签' }), {
    target: { value: 'invalid' },
  })
  expect(await screen.findByText('保留用户提示')).toBeTruthy()
})
