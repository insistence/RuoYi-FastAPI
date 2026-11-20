import { localeState } from '@/i18n/adapter'

const numberFormatters = new Map()

function formatWithStyle(value, style, fractionDigits) {
  const locale = localeState.locale
  const key = `${locale}:${style}:${fractionDigits}`
  if (!numberFormatters.has(key)) {
    numberFormatters.set(
      key,
      new Intl.NumberFormat(locale, {
        style,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })
    )
  }
  return numberFormatters.get(key).format(value)
}

/**
 * 按当前界面语言显示数值及指定的小数位数。
 *
 * @param {number} value 待显示的数值
 * @param {number} [fractionDigits=0] 保留的小数位数
 * @returns {string} 本地化数值
 */
export function formatNumber(value, fractionDigits = 0) {
  return formatWithStyle(value, 'decimal', fractionDigits)
}

/**
 * 将监控接口使用的百分数转换为 Intl 使用的比值，保留一位小数。
 *
 * @param {number} value 百分数，例如 25 表示 25%
 * @returns {string} 本地化百分比
 */
export function formatPercentage(value) {
  return formatWithStyle(value / 100, 'percent', 1)
}
