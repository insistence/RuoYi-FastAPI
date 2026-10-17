const fs = require('node:fs')
const path = require('node:path')
const collection = require('@iconify-json/mdi/icons.json')
// Same MDI symbols used by the Vue mobile pages; emit only these small assets.
const names = [
  'magnify',
  'bell-outline',
  'bell',
  'calendar',
  'file-document-edit',
  'newspaper',
  'chart-bar',
  'clipboard-text-outline',
  'account-group',
  'face-agent',
  'forum',
  'thumb-up',
  'account-edit',
  'help-circle',
  'heart-outline',
  'cog-outline',
  'chat',
  'image-multiple',
  'account',
  'badge-account',
  'office-building',
  'cog',
  'book-open-page-variant',
  'bullhorn',
  'file-document-outline',
  'dots-horizontal',
  'lock',
  'security',
  'phone',
  'email',
  'shield-account',
  'earth',
  'refresh',
  'delete',
  'chevron-right',
  'chevron-down',
  'github',
  'help-circle-outline',
]
const css = names
  .map((name) => {
    const icon = collection.icons[name]
    if (!icon) throw new Error(`Missing MDI icon: ${name}`)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width || collection.width} ${icon.height || collection.height}">${icon.body.replaceAll('currentColor', '#000')}</svg>`
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    return `.i-mdi-${name}{display:inline-block;width:1em;height:1em;background-color:currentColor;-webkit-mask:${url} no-repeat center/contain;mask:${url} no-repeat center/contain}`
  })
  .join('\n')
const directory = path.join(__dirname, '../src/styles')
fs.mkdirSync(directory, { recursive: true })
fs.writeFileSync(
  path.join(directory, 'icons.css'),
  '/* Generated from @iconify-json/mdi (Apache-2.0). */\n' + css + '\n'
)

fs.writeFileSync(
  path.join(directory, 'native-icons.json'),
  JSON.stringify(
    Object.fromEntries(
      names.map((name) => [
        name,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${collection.icons[name].body}</svg>`,
      ])
    ),
    null,
    2
  ) + '\n'
)
