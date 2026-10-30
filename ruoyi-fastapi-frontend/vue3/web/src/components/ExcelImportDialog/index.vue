<template>
  <el-dialog
    :title="title || $t('components:importData')"
    v-model="visible"
    :width="width"
    append-to-body
    @close="handleClose"
  >
    <el-upload
      ref="uploadRef"
      :limit="1"
      accept=".xlsx, .xls"
      :headers="headers"
      :action="uploadUrl"
      :disabled="isUploading"
      :on-progress="handleProgress"
      :on-change="handleFileChange"
      :on-remove="handleFileRemove"
      :on-success="handleSuccess"
      :auto-upload="false"
      drag
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        {{ $t('components:dragFilesHereOr') }}<em>{{ $t('components:clickToUpload') }}</em>
      </div>
      <template #tip>
        <div class="el-upload__tip text-center">
          <div class="el-upload__tip">
            <el-checkbox v-model="updateSupport"> {{ updateSupportLabel }} </el-checkbox>
          </div>
          <span>{{ $t('components:onlyXlsAndXlsxFilesCanBeImported') }}</span>
          <el-link
            v-if="templateUrl"
            type="primary"
            underline="never"
            style="font-size: 12px; vertical-align: baseline"
            @click="handleDownloadTemplate"
            >{{ $t('components:downloadTemplate') }}</el-link
          >
        </div>
      </template>
    </el-upload>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="primary"
          @click="handleSubmit"
          >{{ $t('system:confirm') }}</el-button
        >
        <el-button @click="visible = false">{{ $t('system:cancel') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { getToken } from '@/utils/auth'

const { proxy } = getCurrentInstance()

const props = defineProps({
  // 对话框标题
  title: {
    type: String,
    default: '',
  },
  // 对话框宽度
  width: {
    type: String,
    default: '400px',
  },
  // 上传接口地址（必传）
  action: {
    type: String,
    required: true,
  },
  // 模板下载接口地址，不传则不显示下载模板链接
  templateAction: {
    type: String,
    default: '',
  },
  // 模板文件名前缀
  templateFileName: {
    type: String,
    default: 'template',
  },
  // 覆盖更新勾选框的说明文字
  updateSupportLabel: {
    type: String,
    default: () => t('components:updateExistingRecords'),
  },
})

const emit = defineEmits(['success'])

const uploadRef = ref(null)
const visible = ref(false)
const selectedFile = ref(null)
const isUploading = ref(false)
const updateSupport = ref(false)
const headers = { Authorization: 'Bearer ' + getToken() }

const uploadUrl = computed(() => {
  return (
    import.meta.env.VITE_APP_BASE_API +
    props.action +
    '?updateSupport=' +
    (updateSupport.value ? 1 : 0)
  )
})

const templateUrl = computed(() => !!props.templateAction)

// 打开对话框（供父组件通过 ref 调用）
function open() {
  updateSupport.value = false
  isUploading.value = false
  visible.value = true
  nextTick(() => {
    selectedFile.value = null
    uploadRef.value?.clearFiles()
  })
}

// 关闭时清理
function handleClose() {
  isUploading.value = false
  selectedFile.value = null
  uploadRef.value?.clearFiles()
}

// 下载模板
function handleDownloadTemplate() {
  proxy.download(props.templateAction, {}, `${props.templateFileName}_${new Date().getTime()}.xlsx`)
}

// 上传进度
function handleProgress() {
  isUploading.value = true
}

/** 文件选择处理 */
const handleFileChange = (file, fileList) => {
  selectedFile.value = file
}

/** 文件删除处理 */
const handleFileRemove = (file, fileList) => {
  selectedFile.value = null
}

// 上传成功
function handleSuccess(response) {
  visible.value = false
  isUploading.value = false
  selectedFile.value = null
  uploadRef.value?.clearFiles()
  proxy.$alert(
    "<div style='overflow:auto;overflow-x:hidden;max-height:70vh;padding:10px 20px 0;'>" +
      response.msg +
      '</div>',
    t('components:importResults'),
    { dangerouslyUseHTMLString: true }
  )
  emit('success')
}

// 提交上传
function handleSubmit() {
  const file = selectedFile.value
  if (
    !file ||
    file.length === 0 ||
    (!file.name.toLowerCase().endsWith('.xls') && !file.name.toLowerCase().endsWith('.xlsx'))
  ) {
    proxy.$modal.msgError(t('components:selectAFileWithAnXlsOrXlsxExtension'))
    return
  }
  uploadRef.value.submit()
}

defineExpose({ open })
</script>
