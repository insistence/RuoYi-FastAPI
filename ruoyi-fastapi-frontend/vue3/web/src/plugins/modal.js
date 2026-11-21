import { t } from '@/i18n/adapter'
import { ElMessage, ElMessageBox, ElNotification, ElLoading } from 'element-plus'

let loadingInstance

export default {
  // 消息提示
  msg(content) {
    ElMessage.info(content)
  },
  // 错误消息
  msgError(content) {
    ElMessage.error(content)
  },
  // 成功消息
  msgSuccess(content) {
    ElMessage.success(content)
  },
  // 警告消息
  msgWarning(content) {
    ElMessage.warning(content)
  },
  // 弹出提示
  alert(content) {
    ElMessageBox.alert(content, t('components:systemNotice'))
  },
  // 错误提示
  alertError(content) {
    ElMessageBox.alert(content, t('components:systemNotice'), { type: 'error' })
  },
  // 成功提示
  alertSuccess(content) {
    ElMessageBox.alert(content, t('components:systemNotice'), { type: 'success' })
  },
  // 警告提示
  alertWarning(content) {
    ElMessageBox.alert(content, t('components:systemNotice'), { type: 'warning' })
  },
  // 通知提示
  notify(content) {
    ElNotification.info(content)
  },
  // 错误通知
  notifyError(content) {
    ElNotification.error(content)
  },
  // 成功通知
  notifySuccess(content) {
    ElNotification.success(content)
  },
  // 警告通知
  notifyWarning(content) {
    ElNotification.warning(content)
  },
  // 确认窗体
  confirm(content) {
    return ElMessageBox.confirm(content, t('components:systemNotice'), {
      confirmButtonText: t('common:confirm'),
      cancelButtonText: t('common:cancel'),
      type: 'warning',
    })
  },
  // 提交内容
  prompt(content) {
    return ElMessageBox.prompt(content, t('components:systemNotice'), {
      confirmButtonText: t('common:confirm'),
      cancelButtonText: t('common:cancel'),
      type: 'warning',
    })
  },
  // 打开遮罩层
  loading(content) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: content,
      background: 'rgba(0, 0, 0, 0.7)',
    })
  },
  // 关闭遮罩层
  closeLoading() {
    loadingInstance.close()
  },
}
