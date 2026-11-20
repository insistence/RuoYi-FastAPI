// Element UI 校验器只接收字符串消息；校验时解析惰性翻译，不修改原规则和表单值。
export function resolveRuleMessages(rule) {
  if (Array.isArray(rule)) return rule.map(resolveRuleMessages)
  if (!rule || typeof rule !== 'object') return rule
  const resolved = { ...rule }
  if (typeof rule.message === 'function') resolved.message = rule.message()
  if (rule.fields) {
    resolved.fields = Object.fromEntries(
      Object.entries(rule.fields).map(([field, value]) => [field, resolveRuleMessages(value)])
    )
  }
  if (rule.defaultField) resolved.defaultField = resolveRuleMessages(rule.defaultField)
  return resolved
}
