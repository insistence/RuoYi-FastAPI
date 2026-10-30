import { t as translate } from '../../../../src/i18n/index.js'
/** Parse the backend's newline-delimited JSON, including a final line without a newline. */
export async function readChatStream(body, onEvent, signal, t = translate) {
  if (!body) throw new Error(t('plugin.ai:theServerDidNotReturnConversationContent'))
  const reader = body.getReader(),
    decoder = new TextDecoder()
  let buffer = '',
    completed = false
  const emit = (line) => {
    if (line.trim()) onEvent(JSON.parse(line))
  }
  try {
    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        if (buffer.trim()) emit(buffer)
        completed = true
        break
      }
      buffer += decoder.decode(value, { stream: true })
      let newline
      while ((newline = buffer.indexOf('\n')) !== -1) {
        emit(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
      }
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
