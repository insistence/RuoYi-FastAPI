import { resolveText } from '@/i18n/adapter'

/**
 * @classdesc 字典数据
 * @property {String} label 标签
 * @property {*} value 标签
 * @property {Object} raw 原始数据
 */
export default class DictData {
  get label() {
    return resolveText(this.originalLabel, this.raw?.dictLabelI18n)
  }

  constructor(label, value, raw) {
    this.originalLabel = label
    this.value = value
    this.raw = raw
  }
}
