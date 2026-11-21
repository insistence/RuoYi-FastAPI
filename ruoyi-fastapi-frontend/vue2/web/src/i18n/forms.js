import { resolveRuleMessages } from './validation.mjs'

export default {
  install(Vue) {
    Vue.mixin({
      created() {
        if (this.$options.name !== 'ElFormItem') return
        const getRules = this.getRules
        this.getRules = (...args) => resolveRuleMessages(getRules(...args))
      },
      watch: {
        '$locale.locale'() {
          if (this.$options.name !== 'ElForm') return
          this.$nextTick(() => {
            this.fields
              .filter((field) => field.validateState === 'error')
              .forEach((field) => {
                field.validate('', () => {})
              })
          })
        },
      },
    })
  },
}
