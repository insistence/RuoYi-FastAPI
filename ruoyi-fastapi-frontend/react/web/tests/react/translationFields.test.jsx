import React from 'react'
import { Button, Form, Input } from 'antd'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import TranslationFields, { SourceLocaleField } from '@/components/TranslationFields'
import BusinessFileUpload from '@/components/BusinessFileUpload'
import { i18n } from '@/i18n'

test('source and English labels identify separate editable values in the submitted form', async () => {
  i18n.setAccount(null)
  await act(() => i18n.setPreference('zh-CN'))
  const onFinish = vi.fn()
  render(
    <Form
      name="translation-editor"
      className="ruoyi-dialog-form"
      labelCol={{ flex: '80px' }}
      wrapperCol={{ flex: '1 1 0' }}
      initialValues={{ dictName: '原始名称', dictNameI18n: { 'en-US': 'Original name' } }}
      onFinish={onFinish}
    >
      <SourceLocaleField
        name="dictName"
        label="字典名称"
      >
        <Input />
      </SourceLocaleField>
      <TranslationFields
        name="dictNameI18n"
        label="字典名称"
      />
      <Button htmlType="submit">Save translations</Button>
    </Form>
  )
  const source = screen.getByRole('textbox', { name: '字典名称 · 原文：简体中文' })
  const english = screen.getByRole('textbox', { name: '字典名称 · English' })
  expect(source.value).toBe('原始名称')
  expect(english.value).toBe('Original name')
  fireEvent.change(english, { target: { value: 'Updated English name' } })
  expect(source.value).toBe('原始名称')
  fireEvent.click(screen.getByRole('button', { name: 'Save translations' }))
  await waitFor(() =>
    expect(onFinish).toHaveBeenCalledWith({
      dictName: '原始名称',
      dictNameI18n: { 'en-US': 'Updated English name' },
    })
  )
})

test.each(['zh-CN', 'en-US'])(
  'business upload guidance resolves a string in %s',
  async (locale) => {
    await act(() => i18n.setPreference(locale))
    const { container } = render(
      <BusinessFileUpload
        value={[]}
        drag={false}
        fileType={['pdf']}
      />
    )
    const hint = container.querySelector('small').textContent
    expect(hint.startsWith(i18n.t('common:upload') + ' ')).toBe(true)
    expect(hint).toContain('pdf')
    expect(hint).not.toContain('returned an object')
  }
)
