<template>
  <el-dialog
    v-model="open"
    width="500px"
    :title="$t('tools:chooseGenerationType')"
    @open="onOpen"
    @close="onClose"
  >
    <el-form
      ref="codeTypeForm"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item
        :label="$t('tools:generationType')"
        prop="type"
      >
        <el-radio-group v-model="formData.type">
          <el-radio-button
            v-for="(item, index) in typeOptions"
            :key="index"
            :label="item.value"
          >
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        v-if="showFileName"
        :label="$t('tools:fileName')"
        prop="fileName"
      >
        <el-input
          v-model="formData.fileName"
          :placeholder="$t('tools:enterFileName')"
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="onClose">{{ $t('common:cancel') }}</el-button>
      <el-button
        type="primary"
        @click="handelConfirm"
        >{{ $t('common:confirm') }}</el-button
      >
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
const open = defineModel()
const props = defineProps({
  showFileName: Boolean,
})
const emit = defineEmits(['confirm'])
const formData = ref({
  fileName: undefined,
  type: 'file',
})
const codeTypeForm = ref()
const rules = {
  fileName: [
    {
      required: true,
      get message() {
        return t('tools:enterFileName')
      },
      trigger: 'blur',
    },
  ],
  type: [
    {
      required: true,
      get message() {
        return t('tools:builder.generationRequired')
      },
      trigger: 'change',
    },
  ],
}
const typeOptions = ref([
  {
    get label() {
      return t('tools:builder.page')
    },
    value: 'file',
  },
  {
    get label() {
      return t('tools:builder.dialog')
    },
    value: 'dialog',
  },
])
function onOpen() {
  if (props.showFileName) {
    formData.value.fileName = `${+new Date()}.vue`
  }
}
function onClose() {
  open.value = false
}
function handelConfirm() {
  codeTypeForm.value.validate((valid) => {
    if (!valid) return
    emit('confirm', { ...formData.value })
    onClose()
  })
}
</script>
