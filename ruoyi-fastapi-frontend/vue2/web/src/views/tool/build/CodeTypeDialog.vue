<template>
  <div>
    <el-dialog
      v-bind="$attrs"
      width="500px"
      :close-on-click-modal="false"
      :modal-append-to-body="false"
      v-on="$listeners"
      @open="onOpen"
      @close="onClose"
    >
      <el-row :gutter="15">
        <el-form
          ref="elForm"
          :model="formData"
          :rules="rules"
          size="medium"
          label-width="100px"
        >
          <el-col :span="24">
            <el-form-item
              :label="$t('tool:builder.generationType')"
              prop="type"
            >
              <el-radio-group v-model="formData.type">
                <el-radio-button
                  v-for="(item, index) in typeOptions"
                  :key="index"
                  :label="item.value"
                  :disabled="item.disabled"
                >
                  {{ item.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item
              v-if="showFileName"
              :label="$t('tool:builder.fileName')"
              prop="fileName"
            >
              <el-input
                v-model="formData.fileName"
                :placeholder="$t('tool:builder.enterFileName')"
                clearable
              />
            </el-form-item>
          </el-col>
        </el-form>
      </el-row>

      <div slot="footer">
        <el-button @click="close"> {{ $t('tool:builder.cancel') }} </el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
        >
          {{ $t('tool:builder.confirm') }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script>
import { t } from '@/i18n/adapter'

export default {
  inheritAttrs: false,
  props: ['showFileName'],
  data() {
    return {
      formData: {
        fileName: undefined,
        type: 'file',
      },
      rules: {
        fileName: [
          {
            required: true,
            message: () => t('tool:builder.enterFileName'),
            trigger: 'blur',
          },
        ],
        type: [
          {
            required: true,
            message: () => t('tool:builder.typeRequired'),
            trigger: 'change',
          },
        ],
      },
      typeOptions: [
        {
          get label() {
            return t('tool:builder.page')
          },
          value: 'file',
        },
        {
          get label() {
            return t('tool:builder.dialog')
          },
          value: 'dialog',
        },
      ],
    }
  },
  computed: {},
  watch: {},
  mounted() {},
  methods: {
    onOpen() {
      if (this.showFileName) {
        this.formData.fileName = `${+new Date()}.vue`
      }
    },
    onClose() {},
    close(e) {
      this.$emit('update:visible', false)
    },
    handleConfirm() {
      this.$refs.elForm.validate((valid) => {
        if (!valid) return
        this.$emit('confirm', { ...this.formData })
        this.close()
      })
    },
  },
}
</script>
