import assert from 'node:assert/strict'
import { registerGeneratedResources } from '../../src/i18n/generated.mjs'
import { after, test } from 'node:test'
import { mkdtemp, mkdir, rm, writeFile, readdir, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { build } from 'esbuild'
import { computed, effectScope, nextTick, reactive, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { restoreVisitedViews, serializeVisitedViews } from '../../src/utils/tagsView.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cache = join(root, 'node_modules/.cache')
await mkdir(cache, { recursive: true })
const temporary = await mkdtemp(join(cache, 'i18n-tests-'))
after(() => rm(temporary, { recursive: true, force: true }))
const inject = join(temporary, 'auto-imports.mjs')
await writeFile(inject, "export { ref, computed } from 'vue'\n")
const output = join(temporary, 'application.mjs')
await build({
  stdin: {
    contents: `
      export { t, useI18n, resolveRouteTitle } from './src/i18n/adapter.js'
      export { useLocaleForm } from './src/composables/useLocaleForm.js'
      export { usePasswordRule } from './src/utils/passwordRule.js'
    `,
    resolveDir: root,
  },
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  alias: { '@': join(root, 'src') },
  inject: [inject],
  define: { 'import.meta.env': JSON.stringify({ VITE_APP_BASE_API: '/test-api' }) },
})

const previousStorage = globalThis.sessionStorage
globalThis.sessionStorage = { getItem: () => null }
const { t, useI18n, resolveRouteTitle, useLocaleForm, usePasswordRule } = await import(
  pathToFileURL(output)
)
if (previousStorage === undefined) delete globalThis.sessionStorage
else globalThis.sessionStorage = previousStorage
const { i18n } = useI18n()
const generatedResources = {}
for (const entry of i18n.registry.entries) {
  const directory = join(root, 'src/i18n/locales', entry.code)
  for (const file of (await readdir(directory)).filter((name) =>
    /^generated\..+\.json$/.test(name)
  )) {
    generatedResources[`./i18n/locales/${entry.code}/${file}`] = JSON.parse(
      await readFile(join(directory, file), 'utf8')
    )
  }
}
registerGeneratedResources(i18n, generatedResources)

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/index',
        name: 'Index',
        component: {},
        meta: { title: '首页', titleKey: 'layout:routes.home', affix: true },
      },
      {
        path: '/user/:id',
        name: 'User',
        component: {},
        meta: { title: '个人中心', titleKey: 'layout:routes.profile' },
      },
      {
        path: '/custom',
        name: 'Custom',
        component: {},
        meta: { title: '原始名称', titleI18n: { 'en-US': '<b>Custom menu</b>' } },
      },
      {
        path: '/:pathMatch(.*)*',
        component: {},
        meta: { title: '找不到网页', titleKey: 'layout:routes.notFound' },
      },
    ],
  })
}

test('route titles react to language changes without replacing route or form state', async () => {
  const router = createTestRouter()
  await router.push('/user/42?tab=profile#details')
  const route = router.currentRoute.value
  const input = reactive({ nickname: '未保存的输入' })
  const title = computed(() => resolveRouteTitle(router.currentRoute.value))
  await i18n.setPreference('zh-CN')
  assert.equal(title.value, '个人中心')
  await i18n.setPreference('en-US')
  assert.equal(title.value, 'Profile')
  assert.equal(router.currentRoute.value, route)
  assert.equal(input.nickname, '未保存的输入')
  assert.equal(route.meta.title, '个人中心')
  assert.equal(resolveRouteTitle(router.resolve('/custom')), '<b>Custom menu</b>')
  await i18n.setPreference('zh-CN')
  assert.equal(resolveRouteTitle(router.resolve('/custom')), '原始名称')
})

test('persisted tabs retain route parameters and explicit titles, not translated metadata', () => {
  const router = createTestRouter()
  const profile = router.resolve('/user/42?tab=profile#details')
  const snapshot = serializeVisitedViews([
    router.resolve('/index'),
    { ...profile, title: 'Stale translated title' },
    { ...router.resolve('/custom'), customTitle: 'layout:routes.home' },
  ])
  assert.equal(snapshot.version, 1)
  assert.equal(snapshot.views.length, 2)
  assert.ok(snapshot.views.every((view) => !('title' in view) && !('meta' in view)))
  const restored = restoreVisitedViews(JSON.parse(JSON.stringify(snapshot)), (view) =>
    router.resolve(view)
  )
  assert.equal(restored[0].params.id, '42')
  assert.equal(restored[0].query.tab, 'profile')
  assert.equal(restored[0].hash, '#details')
  assert.equal(restored[0].meta.titleKey, 'layout:routes.profile')
  assert.equal(restored[1].customTitle, 'layout:routes.home')
})

test('legacy tabs use fresh metadata and discard removed or malformed routes', () => {
  const router = createTestRouter()
  const legacy = [
    { path: '/user/42', fullPath: '/user/42?tab=old', title: '旧名称', meta: { title: '旧名称' } },
    { path: '/custom', title: '自定义标题', meta: { title: '原始名称' } },
    { path: '/removed', title: '已移除的菜单' },
    null,
    { path: 123 },
  ]
  const restored = restoreVisitedViews(legacy, (view) => router.resolve(view))
  assert.equal(restored.length, 2)
  assert.equal(restored[0].meta.titleKey, 'layout:routes.profile')
  assert.equal(restored[0].customTitle, undefined)
  assert.equal(restored[1].customTitle, '自定义标题')
  assert.deepEqual(restoreVisitedViews({ version: 99, views: legacy }, router.resolve), [])
  assert.deepEqual(restoreVisitedViews({ version: 1, views: 'invalid' }, router.resolve), [])
})

test('language changes revalidate visible errors only and stop when the form is disposed', async () => {
  await i18n.setPreference('zh-CN')
  const input = { username: 'retained', password: '' }
  const message = shallowRef(t('common:login.passwordRequired'))
  let validations = 0
  const form = shallowRef({
    fields: [
      {
        validateState: 'error',
        validate: async () => {
          validations++
          message.value = t('common:login.passwordRequired')
          throw new Error(message.value)
        },
      },
      { validateState: '', validate: () => assert.fail('untouched field was validated') },
      { validateState: 'success', validate: () => assert.fail('valid field was validated') },
    ],
  })
  const scope = effectScope()
  scope.run(() => useLocaleForm(form))
  try {
    await i18n.setPreference('en-US')
    await nextTick()
    assert.equal(message.value, 'Enter your password')
    assert.equal(validations, 1)
    assert.deepEqual(input, { username: 'retained', password: '' })
  } finally {
    scope.stop()
  }
  await i18n.setPreference('zh-CN')
  await nextTick()
  assert.equal(validations, 1)
})

test('password rules translate at validation time while retaining the rule instances', async () => {
  await i18n.setPreference('zh-CN')
  const { registerPwdValidator, pwdPromptValidator } = usePasswordRule()
  const rules = registerPwdValidator.value
  assert.equal(rules[0].message(), '请输入您的密码')
  await i18n.setPreference('en-US')
  assert.equal(registerPwdValidator.value, rules)
  assert.equal(rules[0].message(), 'Enter your password')
  assert.equal(pwdPromptValidator('short'), 'Password must be between 6 and 20 characters')
  assert.equal(rules[2].pattern.test('safePassword1'), true)
  assert.equal(rules[2].pattern.test('<unsafe>'), false)
  assert.ok(rules[2].message().includes('Password must not contain'))
})

test('registered namespaces provide English plurals and complete interpolated messages', async () => {
  await i18n.setPreference('en-US')
  assert.equal(t('layout:search.results', { count: 1 }), 'Found 1 result')
  assert.equal(t('layout:search.results', { count: 2 }), 'Found 2 results')
  assert.equal(
    t('auth:register.success', { username: 'Ada' }),
    'Your account Ada has been created successfully!'
  )
  await i18n.setPreference('zh-CN')
  assert.equal(t('layout:search.results', { count: 1 }), '找到 1 个结果')
})

test('every checked application and plugin namespace is registered in the actual runtime', async () => {
  for (const entry of i18n.registry.entries) {
    const files = await readdir(join(root, 'src/i18n/locales', entry.code))
    for (const file of files.filter((name) => name.endsWith('.json'))) {
      assert.equal(
        i18n.engine.hasResourceBundle(entry.code, file.slice(0, -5)),
        true,
        entry.code + ':' + file
      )
    }
    assert.equal(i18n.engine.hasResourceBundle(entry.code, 'plugin.ai'), true)
  }
})
