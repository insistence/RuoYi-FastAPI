import { patternFinder } from '@x18n/builtins/finders'

// https://x18n.dev/raw/plugins/capabilities.md
export default {
  name: 'ruoyi-project-resources',
  config(draft) {
    // build 是本项目表单设计器源码名，不能套用通用的构建产物排除规则。
    draft.usage.exclude = draft.usage.exclude.filter((pattern) => pattern !== '**/build/**')
    draft.usage.exclude.push('build/**')
  },
  localeFinders: [
    {
      ...patternFinder,
      override: true,
      resolveNew(target, context) {
        // 0.1.3 默认 finder 未处理固定 namespace 的新资源路径，优先补全此分支。
        const resource = context.config.resources.find(
          (entry) => entry.namespace === target.namespace && entry.pattern.includes('{locale}')
        )
        return resource
          ? resource.pattern.replace('{locale}', target.locale)
          : patternFinder.resolveNew(target, context)
      },
    },
  ],
}
