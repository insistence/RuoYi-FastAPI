import assert from 'node:assert/strict'
import { test } from 'node:test'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import {
  highlightPreviewCode,
  initialPreviewFile,
  previewFileLabel,
} from '../../src/utils/codePreview.mjs'

hljs.registerLanguage('json', json)
hljs.registerLanguage('py', python)

test('generated JSON locale files have distinct readable tabs and valid highlighted content', () => {
  const paths = [
    'frontend/src/i18n/locales/zh-CN/demo.json',
    'frontend/src/i18n/locales/en-US/demo.json',
  ]
  assert.notEqual(previewFileLabel(paths[0]), previewFileLabel(paths[1]))
  assert.equal(previewFileLabel(paths[0]), paths[0])
  const highlighted = highlightPreviewCode(
    '{"title":"<img src=x onerror=alert(1)>"}',
    paths[0],
    hljs
  )
  assert.match(highlighted, /&lt;img/)
  assert.doesNotMatch(highlighted, /<img/)
})

test('Python template remains the initial tab with its actual unique key', () => {
  const files = {
    'frontend/src/i18n/locales/en-US/demo.json': '{}',
    'python/do.py.jinja2': 'class Demo: pass',
  }
  assert.equal(initialPreviewFile(files), 'python/do.py.jinja2')
  assert.equal(previewFileLabel('python/do.py.jinja2'), 'do.py')
  assert.match(
    highlightPreviewCode(files['python/do.py.jinja2'], 'python/do.py.jinja2', hljs),
    /class/
  )
  assert.equal(initialPreviewFile({ 'new/README.md': 'text' }), 'new/README.md')
  assert.equal(initialPreviewFile({}), '')
})

test('unsupported preview formats render escaped text without throwing or injecting HTML', () => {
  for (const path of ['README.md', 'README.constructor', 'README.__proto__']) {
    assert.equal(
      highlightPreviewCode('<script>&</script>', path, hljs),
      '&lt;script&gt;&amp;&lt;/script&gt;'
    )
  }
})
