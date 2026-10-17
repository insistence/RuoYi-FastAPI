import { message as fallbackMessage, Modal } from 'antd'
// 应用上下文绑定前使用静态反馈 API，绑定后使用可继承主题和语言的实例。
let feedback = { message: fallbackMessage, modal: Modal }
/**
 * 绑定 Ant Design App 提供的消息与弹窗实例。
 * @param {Object} value 包含 message 和 modal 的上下文反馈对象
 */
export function bindFeedback(value) {
  feedback = value
}
// 统一消息入口，调用时读取最新绑定的上下文实例。
export const message = {
  success: (...args) => feedback.message.success(...args),
  warning: (...args) => feedback.message.warning(...args),
  error: (...args) => feedback.message.error(...args),
  info: (...args) => feedback.message.info(...args),
  loading: (...args) => feedback.message.loading(...args),
}
/**
 * 显示确认弹窗，将用户选择转换为 Promise 结果。
 * @param {import("react").ReactNode} content 提示内容
 * @param {string} [title="系统提示"] 弹窗标题
 * @returns {Promise<boolean>} 确认时返回 true，取消时以 cancel 错误拒绝
 */
export function confirm(content, title = '系统提示') {
  return new Promise((resolve, reject) =>
    feedback.modal.confirm({
      title,
      content,
      okText: '确定',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => reject(new Error('cancel')),
    })
  )
}
/**
 * 遇到夏令时回拨造成的重复本地时间时，让用户明确选择 UTC 偏移。
 * @param {Object} error 包含提示信息和候选偏移 candidates 的时间错误
 * @returns {Promise<string>} 用户选定的偏移；取消时拒绝
 */
export function chooseOffset(error) {
  return new Promise((resolve, reject) => {
    let offset = error.candidates[0].offset
    feedback.modal.confirm({
      title: '选择重复时间',
      content: (
        <div>
          <p>{error.message}</p>
          <select
            aria-label="UTC 偏移"
            defaultValue={offset}
            onChange={(event) => {
              offset = event.target.value
            }}
          >
            {error.candidates.map((candidate) => (
              <option
                key={candidate.offset}
                value={candidate.offset}
              >
                {candidate.offset}
              </option>
            ))}
          </select>
        </div>
      ),
      okText: '使用所选时间',
      cancelText: '返回修改',
      onOk: () => resolve(offset),
      onCancel: () => reject(new Error('cancel')),
    })
  })
}
// 保留业务调用使用的简写消息方法。
export default {
  msg: message.info,
  msgSuccess: message.success,
  msgError: message.error,
  msgWarning: message.warning,
  confirm,
}
