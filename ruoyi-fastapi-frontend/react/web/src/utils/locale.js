import zhCN from 'antd/es/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

// 日期面板的星期、月份由 Day.js 提供，需要与 Ant Design 的语言保持一致。
dayjs.locale('zh-cn')

export default zhCN
