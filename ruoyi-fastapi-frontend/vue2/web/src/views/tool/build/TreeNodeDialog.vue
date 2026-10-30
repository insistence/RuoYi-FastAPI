<template>
  <div>
    <el-dialog
      v-bind="$attrs"
      :close-on-click-modal="false"
      :modal-append-to-body="false"
      v-on="$listeners"
      @open="onOpen"
      @close="onClose"
    >
      <el-row :gutter="0">
        <el-form
          ref="elForm"
          :model="formData"
          :rules="rules"
          size="small"
          label-width="100px"
        >
          <el-col :span="24">
            <el-form-item
              :label="$t('tool:builder.optionLabel')"
              prop="label"
            >
              <el-input
                v-model="formData.label"
                :placeholder="$t('tool:builder.enterOptionLabel')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item
              :label="$t('tool:builder.optionValue')"
              prop="value"
            >
              <el-input
                v-model="formData.value"
                :placeholder="$t('tool:builder.enterOptionValue')"
                clearable
              >
                <el-select
                  slot="append"
                  v-model="dataType"
                  :style="{ width: '100px' }"
                >
                  <el-option
                    v-for="(item, index) in dataTypeOptions"
                    :key="index"
                    :label="item.label"
                    :value="item.value"
                    :disabled="item.disabled"
                  />
                </el-select>
              </el-input>
            </el-form-item>
          </el-col>
        </el-form>
      </el-row>
      <div slot="footer">
        <el-button
          type="primary"
          @click="handleConfirm"
        >
          {{ $t('tool:builder.confirm') }}
        </el-button>
        <el-button @click="close"> {{ $t('tool:builder.cancel') }} </el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script>
import { t } from '@/i18n/adapter'

import { isNumberStr } from '@/utils/index'

export default {
  components: {},
  inheritAttrs: false,
  props: [],
  data() {
    return {
      id: 100,
      formData: {
        label: undefined,
        value: undefined,
      },
      rules: {
        label: [
          {
            required: true,
            message: () => t('tool:builder.optionName'),
            trigger: 'blur',
          },
        ],
        value: [
          {
            required: true,
            message: () => t('tool:builder.optionValue'),
            trigger: 'blur',
          },
        ],
      },
      dataType: 'string',
      dataTypeOptions: [
        {
          get label() {
            return t('tool:builder.string')
          },
          value: 'string',
        },
        {
          get label() {
            return t('tool:builder.number')
          },
          value: 'number',
        },
      ],
    }
  },
  computed: {},
  watch: {
    'formData.value': function (val) {
      this.dataType = isNumberStr(val) ? 'number' : 'string'
    },
  },
  created() {},
  mounted() {},
  methods: {
    onOpen() {
      this.formData = {
        label: undefined,
        value: undefined,
      }
    },
    onClose() {},
    close() {
      this.$emit('update:visible', false)
    },
    handleConfirm() {
      this.$refs.elForm.validate((valid) => {
        if (!valid) return
        if (this.dataType === 'number') {
          this.formData.value = parseFloat(this.formData.value)
        }
        this.formData.id = this.id++
        this.$emit('commit', this.formData)
        this.close()
      })
    },
  },
}
</script>
