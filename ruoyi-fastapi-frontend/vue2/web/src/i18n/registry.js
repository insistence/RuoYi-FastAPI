import meta from './locale-meta.json'

export { meta }
const messages = require.context('./locales', true, /\.json$/)
export const resources = {}
messages.keys().forEach((path) => {
  const [, locale, namespace] = path.match(/^\.\/([^/]+)\/([^/]+)\.json$/) || []
  if (!locale || !namespace) return
  if (!resources[locale]) resources[locale] = {}
  resources[locale][namespace] = messages(path)
})

const pluginMessages = require.context('../../plugins', true, /\/locales\/[^/]+\.json$/)
pluginMessages.keys().forEach((path) => {
  const [, plugin, locale] = path.match(/^\.\/([^/]+)\/locales\/([^/]+)\.json$/) || []
  if (!locale || !plugin) return
  if (!resources[locale]) resources[locale] = {}
  resources[locale]['plugin.' + plugin] = pluginMessages(path)
})
