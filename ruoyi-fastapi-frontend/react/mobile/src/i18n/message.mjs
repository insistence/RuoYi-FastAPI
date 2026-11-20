let translator

/** 构建配置和协议工具可独立运行，界面启动后由调用方注入翻译器。 */
export function setMessageTranslator(value) {
  translator = value
}

export function translateMessage(key, fallback, options) {
  return translator ? translator(key, options) : fallback
}
