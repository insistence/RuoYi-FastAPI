import Taro from '@tarojs/taro'
export default {
  // 消息提示
  msg(content) {
    Taro.showToast({
      title: content,
      icon: 'none',
    })
  },
  // 错误消息
  msgError(content) {
    Taro.showToast({
      title: content,
      icon: 'error',
    })
  },
  // 成功消息
  msgSuccess(content) {
    Taro.showToast({
      title: content,
      icon: 'success',
    })
  },
  // 隐藏消息
  hideMsg(content) {
    Taro.hideToast()
  },
  // 弹出提示
  alert(content, title) {
    Taro.showModal({
      title: title || '系统提示',
      content: content,
      showCancel: false,
    })
  },
  // 确认窗体
  confirm(content, title) {
    return new Promise((resolve, reject) => {
      Taro.showModal({
        title: title || '系统提示',
        content: content,
        cancelText: '取消',
        confirmText: '确定',
        success: function (res) {
          if (res.confirm) {
            resolve(res.confirm)
          }
        },
      })
    })
  },
  // 提示信息
  showToast(option) {
    if (typeof option === 'object') {
      Taro.showToast(option)
    } else {
      Taro.showToast({
        title: option,
        icon: 'none',
        duration: 2500,
      })
    }
  },
  // 打开遮罩层
  loading(content) {
    Taro.showLoading({
      title: content,
      icon: 'none',
    })
  },
  // 关闭遮罩层
  closeLoading() {
    try {
      Taro.hideLoading()
    } catch (e) {
      console.log(e)
    }
  },
}
