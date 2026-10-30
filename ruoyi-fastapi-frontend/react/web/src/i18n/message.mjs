let translator

// 纯工具独立运行时保留原始提示，由应用启动时注入翻译器。
export function setMessageTranslator(value) {
  translator = value
}

export function translateMessage(key, fallback, options) {
  return translator ? translator(key, options) : fallback
}
