<template>
  <div>
    <el-dialog
      :title="$t('tools:addOption')"
      v-model="open"
      width="800px"
      :close-on-click-modal="false"
      :modal-append-to-body="false"
      @open="onOpen"
      @close="onClose"
    >
      <el-form
        ref="treeNodeForm"
        :model="formData"
        :rules="rules"
        label-width="100px"
      >
        <el-col :span="24">
          <el-form-item
            :label="$t('tools:optionLabel')"
            prop="label"
          >
            <el-input
              v-model="formData.label"
              :placeholder="$t('tools:enterOptionLabel')"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item
            :label="$t('tools:optionValue')"
            prop="value"
          >
            <el-input
              v-model="formData.value"
              :placeholder="$t('tools:enterOptionValue')"
              clearable
            >
              <template #append>
                <el-select
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
              </template>
            </el-input>
          </el-form-item>
        </el-col>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            @click="handelConfirm"
            >{{ $t('system:confirm') }}</el-button
          >
          <el-button @click="onClose">{{ $t('system:cancel') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { t } from '@/i18n/adapter'
const open = defineModel()
const emit = defineEmits(['confirm'])
const formData = ref({
  label: undefined,
  value: undefined,
})
const rules = {
  label: [
    {
      required: true,
      get message() {
        return t('tools:enterOptionLabel')
      },
      trigger: 'blur',
    },
  ],
  value: [
    {
      required: true,
      get message() {
        return t('tools:enterOptionValue')
      },
      trigger: 'blur',
    },
  ],
}
const dataType = ref('string')
const dataTypeOptions = ref([
  {
    get label() {
      return t('tools:builder.string')
    },
    value: 'string',
  },
  {
    get label() {
      return t('tools:builder.number')
    },
    value: 'number',
  },
])
const id = ref(100)
const treeNodeForm = ref()

function onOpen() {
  formData.value = {
    label: undefined,
    value: undefined,
  }
}

function onClose() {
  open.value = false
}

function handelConfirm() {
  treeNodeForm.value.validate((valid) => {
    if (!valid) return
    if (dataType.value === 'number') {
      formData.value.value = parseFloat(formData.value.value)
    }
    formData.value.id = id.value++
    emit('commit', formData.value)
    onClose()
  })
}
</script>
