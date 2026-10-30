<template>
  <el-dialog
    :title="title || $t('file:interface.importData')"
    :visible.sync="visible"
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
      :on-success="handleSuccess"
      :auto-upload="false"
      drag
    >
      <i class="el-icon-upload"></i>
      <div class="el-upload__text">
        {{ $t('file:upload.drop') }}<em>{{ $t('file:upload.click') }}</em>
      </div>
      <div
        class="el-upload__tip text-center"
        slot="tip"
      >
        <div
          class="el-upload__tip"
          slot="tip"
        >
          <el-checkbox v-model="updateSupport">
            {{ updateSupportLabel || $t('common:updateExistingRecords') }}
          </el-checkbox>
        </div>
        <span>{{ $t('file:interface.onlyXlsAndXlsxFilesCanBeImported') }}</span>
        <el-link
          v-if="templateUrl"
          type="primary"
          :underline="false"
          style="font-size: 12px; vertical-align: baseline"
          @click="handleDownloadTemplate"
          >{{ $t('common:downloadTemplate') }}</el-link
        >
      </div>
    </el-upload>
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button
        type="primary"
        @click="handleSubmit"
        >{{ $t('common:confirm') }}</el-button
      >
      <el-button @click="visible = false">{{ $t('common:cancel') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'
import { i18n } from '@/i18n'

import { getToken } from '@/utils/auth'

export default {
  props: {
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
    // 模板文件名
    templateFileName: {
      type: String,
      default: 'template',
    },
    // 覆盖更新勾选框的说明文字
    updateSupportLabel: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      visible: false,
      isUploading: false,
      updateSupport: false,
    }
  },
  computed: {
    headers() {
      void this.$locale.locale
      return { Authorization: 'Bearer ' + getToken(), ...i18n.headers }
    },

    uploadUrl() {
      return (
        process.env.VUE_APP_BASE_API +
        this.action +
        '?updateSupport=' +
        (this.updateSupport ? 1 : 0)
      )
    },
    templateUrl() {
      return !!this.templateAction
    },
  },
  methods: {
    // 打开对话框（供父组件通过 ref 调用）
    open() {
      this.updateSupport = false
      this.isUploading = false
      this.visible = true
      this.$nextTick(() => {
        if (this.$refs.uploadRef) {
          this.$refs.uploadRef.clearFiles()
        }
      })
    },
    // 关闭时清理
    handleClose() {
      this.isUploading = false
      if (this.$refs.uploadRef) {
        this.$refs.uploadRef.clearFiles()
      }
    },
    // 下载模板
    handleDownloadTemplate() {
      this.download(
        this.templateAction,
        {},
        `${this.templateFileName}_${new Date().getTime()}.xlsx`
      )
    },
    // 上传进度
    handleProgress() {
      this.isUploading = true
    },
    // 上传成功
    handleSuccess(response) {
      this.visible = false
      this.isUploading = false
      if (this.$refs.uploadRef) {
        this.$refs.uploadRef.clearFiles()
      }
      this.$alert(
        "<div style='overflow:auto;overflow-x:hidden;max-height:70vh;padding:10px 20px 0;'>" +
          response.msg +
          '</div>',
        t('common:importResults'),
        { dangerouslyUseHTMLString: true }
      )
      this.$emit('success')
    },
    // 提交上传
    handleSubmit() {
      const files = this.$refs.uploadRef.uploadFiles
      if (!files || files.length === 0) {
        this.$modal.msgError(t('file:interface.selectAFileToUpload'))
        return
      }
      const name = files[0].name.toLowerCase()
      if (!name.endsWith('.xls') && !name.endsWith('.xlsx')) {
        this.$modal.msgError(t('file:interface.selectAnXlsOrXlsxFile'))
        return
      }
      this.$refs.uploadRef.submit()
    },
  },
}
</script>
