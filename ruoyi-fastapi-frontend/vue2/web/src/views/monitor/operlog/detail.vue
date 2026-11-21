<template>
  <el-dialog
    :title="$t('monitor:messages.operationLogDetails')"
    :visible.sync="visible"
    width="780px"
    append-to-body
    @close="$emit('update:visible', false)"
  >
    <div class="detail-wrap">
      <!-- 基本信息 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <i class="el-icon-info"></i> {{ $t('common:basicInfo') }}
        </div>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:messages.module') }}</span
              ><span class="detail-value">{{ form.title }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:log.businessType') }}</span
              ><span class="detail-value">{{ typeLabel }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:log.operationTime') }}</span
              ><span class="detail-value">{{ parseTime(form.operTime) || '-' }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:job.executionStatus') }}</span>
              <el-tag
                v-if="form.status === 0"
                type="success"
                size="small"
                ><i class="el-icon-check"></i> {{ $t('layout:notices.active') }}</el-tag
              >
              <el-tag
                v-else
                type="danger"
                size="small"
                ><i class="el-icon-close"></i> {{ $t('common:exception') }}</el-tag
              >
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 操作人员 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <i class="el-icon-user"></i> {{ $t('monitor:log.operator') }}
        </div>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:log.operator') }}</span
              ><span class="detail-value">{{ form.operName }}</span>
            </div>
          </el-col>
          <el-col
            :span="12"
            v-if="form.deptName"
          >
            <div class="detail-item">
              <span class="detail-label">{{ $t('system:user.department') }}</span
              ><span class="detail-value">{{ form.deptName }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="24">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:messages.operationAddress') }}</span>
              <span class="detail-value"
                >{{ form.operIp }}&nbsp;&nbsp;<span class="detail-location">{{
                  form.operLocation
                }}</span></span
              >
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 请求信息 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <i class="el-icon-sort"></i> {{ $t('monitor:messages.requestInformation') }}
        </div>
        <el-row class="detail-row">
          <el-col :span="24">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:messages.requestURL') }}</span>
              <span class="detail-value">
                <span :class="'method-tag method-' + form.requestMethod">{{
                  form.requestMethod
                }}</span>
                {{ form.operUrl }}
              </span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="24">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:messages.operationMethod') }}</span
              ><span class="detail-value mono">{{ form.method }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:messages.duration') }}</span
              ><span class="detail-value">{{ form.costTime }} {{ $t('common:milliseconds') }}</span>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 请求参数 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <i class="el-icon-upload2"></i> {{ $t('monitor:messages.requestParameters') }}
        </div>
        <div class="code-body">
          <div class="code-wrap">
            <div class="code-action">
              <el-button
                size="mini"
                icon="el-icon-copy-document"
                @click="copyText(form.operParam)"
                >{{ $t('common:copy') }}</el-button
              >
            </div>
            <pre class="code-pre">{{ formatJson(form.operParam) }}</pre>
          </div>
        </div>
      </div>

      <!-- 返回参数 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <i class="el-icon-download"></i> {{ $t('monitor:messages.responseData') }}
        </div>
        <div class="code-body">
          <div class="code-wrap">
            <div class="code-action">
              <el-button
                size="mini"
                icon="el-icon-copy-document"
                @click="copyText(form.jsonResult)"
                >{{ $t('common:copy') }}</el-button
              >
            </div>
            <pre class="code-pre">{{ formatJson(form.jsonResult) }}</pre>
          </div>
        </div>
      </div>

      <!-- 异常信息 -->
      <div
        class="detail-card"
        v-if="form.status !== 0"
      >
        <div class="detail-card-title error-title">
          <i class="el-icon-warning"></i> {{ $t('monitor:messages.exceptionDetails') }}
        </div>
        <div class="error-body">
          <div class="error-msg">{{ form.errorMsg }}</div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

export default {
  name: 'OperlogDetail',
  dicts: ['sys_oper_type'],
  props: {
    visible: { type: Boolean, default: false },
    row: { type: Object, default: () => ({}) },
  },
  computed: {
    form() {
      return this.row || {}
    },
    typeLabel() {
      return this.selectDictLabel(this.dict.type.sys_oper_type, this.form.businessType) || '-'
    },
  },
  methods: {
    formatJson(str) {
      if (!str) return t('monitor:messages.noData')
      try {
        return JSON.stringify(JSON.parse(str), null, 2)
      } catch {
        return str
      }
    },
    copyText(str) {
      const text = this.formatJson(str)
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() =>
          this.$message({
            message: t('monitor:operlog.copied'),
            type: 'success',
            duration: 1500,
          })
        )
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        this.$message({
          message: t('monitor:operlog.copied'),
          type: 'success',
          duration: 1500,
        })
      }
    },
  },
}
</script>
