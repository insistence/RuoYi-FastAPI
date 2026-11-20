import { existsSync, readdirSync } from 'node:fs'

// 每个项目单独声明语言，新增宿主语言不会要求插件补齐该语言。
const plugins = new URL('./plugins/', import.meta.url)
export default {
  projects: [
    'src/i18n',
    ...readdirSync(plugins, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() && existsSync(new URL(`${entry.name}/x18n.config.mjs`, plugins))
      )
      .map((entry) => `plugins/${entry.name}`),
  ],
}
