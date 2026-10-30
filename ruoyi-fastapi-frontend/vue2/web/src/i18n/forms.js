export default {
  install(Vue) {
    Vue.mixin({
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
