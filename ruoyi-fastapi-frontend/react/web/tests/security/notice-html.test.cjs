const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { test } = require('node:test')
const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')

for (const framework of ['vue2', 'vue3', 'react']) {
  test(`${framework} notice HTML removes active content and keeps rich text`, () => {
    const source = readFileSync(
      resolve(__dirname, `../../../../${framework}/web/src/utils/noticeHtml.js`),
      'utf8'
    )
      .replace("import createDOMPurify from 'dompurify'", '')
      .replace('export function', 'function')
    const window = new JSDOM('').window
    const sanitize = new Function(
      'createDOMPurify',
      'window',
      `${source}; return sanitizeNoticeHtml`
    )(createDOMPurify, window)
    const clean = sanitize(
      '<h2>标题</h2><p><strong>重点</strong></p><img src="/safe.png" onerror="alert(1)"><script>alert(1)</script><svg onload="alert(1)"></svg><a href="jav&#x61;script:alert(1)">x</a><img src="data:text/html,x">'
    )
    assert.match(clean, /<strong>重点<\/strong>/)
    assert.match(clean, /src="\/safe.png"/)
    assert.doesNotMatch(clean, /onerror|onload|<script|<svg|javascript:|data:text/)
    assert.equal(sanitize(clean), clean)
    const styled = sanitize(
      '<p class="ql-align-center"><span style="color: red; background-color: yellow; position: fixed; background-image: url(https://example.com)">正文</span></p>'
    )
    assert.match(styled, /ql-align-center/)
    assert.match(styled, /color: red/)
    assert.match(styled, /background-color: yellow/)
    assert.doesNotMatch(styled, /position|background-image/)
    const video = sanitize(
      '<iframe class="ql-video" src="https://video.example/embed/1" sandbox="allow-same-origin" srcdoc="<script>alert(1)</script>"></iframe>'
    )
    assert.match(video, /src="https:\/\/video.example\/embed\/1"/)
    assert.match(video, /sandbox="allow-scripts allow-presentation"/)
    assert.doesNotMatch(video, /srcdoc|allow-same-origin/)
    window.close()
  })
}
