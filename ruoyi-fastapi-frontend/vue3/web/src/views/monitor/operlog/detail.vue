<template>
  <el-dialog
    :title="$t('monitor:operationLogDetails')"
    v-model="dialogVisible"
    width="780px"
    append-to-body
    @close="$emit('update:visible', false)"
  >
    <div class="detail-wrap">
      <!-- 基本信息 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <el-icon><InfoFilled /></el-icon> {{ $t('system:basicInformation') }}
        </div>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:module') }}</span
              ><span class="detail-value">{{ form.title }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:businessType') }}</span
              ><span class="detail-value">{{ typeLabel }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:operationTime') }}</span
              ><span class="detail-value">{{ parseTime(form.operTime) || '-' }}</span>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:executionStatus') }}</span>
              <el-tag
                v-if="form.status === 0"
                type="success"
                size="small"
                >{{ $t('layout:notices.active') }}</el-tag
              >
              <el-tag
                v-else
                type="danger"
                size="small"
                >{{ $t('monitor:error') }}</el-tag
              >
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 操作人员 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <el-icon><User /></el-icon> {{ $t('system:operator') }}
        </div>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('system:operator') }}</span
              ><span class="detail-value">{{ form.operName }}</span>
            </div>
          </el-col>
          <el-col
            :span="12"
            v-if="form.deptName"
          >
            <div class="detail-item">
              <span class="detail-label">{{ $t('system:department') }}</span
              ><span class="detail-value">{{ form.deptName }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="24">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:operationAddress') }}</span>
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
          <el-icon><Sort /></el-icon> {{ $t('monitor:requestInformation') }}
        </div>
        <el-row class="detail-row">
          <el-col :span="24">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:requestURL') }}</span>
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
              <span class="detail-label">{{ $t('monitor:operationMethod') }}</span
              ><span class="detail-value mono">{{ form.method }}</span>
            </div>
          </el-col>
        </el-row>
        <el-row class="detail-row">
          <el-col :span="12">
            <div class="detail-item">
              <span class="detail-label">{{ $t('monitor:durationLabel') }}</span
              ><span class="detail-value"
                >{{ form.costTime }} {{ $t('monitor:milliseconds') }}</span
              >
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 请求参数 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <el-icon><Upload /></el-icon> {{ $t('monitor:requestParameters') }}
        </div>
        <div class="code-body">
          <div class="code-wrap">
            <div class="code-action">
              <el-button
                size="small"
                :icon="CopyDocument"
                @click="copyText(form.operParam)"
                >{{ $t('monitor:copy') }}</el-button
              >
            </div>
            <pre class="code-pre">{{ formatJson(form.operParam) }}</pre>
          </div>
        </div>
      </div>

      <!-- 返回参数 -->
      <div class="detail-card">
        <div class="detail-card-title">
          <el-icon><Download /></el-icon> {{ $t('monitor:responseData') }}
        </div>
        <div class="code-body">
          <div class="code-wrap">
            <div class="code-action">
              <el-button
                size="small"
                :icon="CopyDocument"
                @click="copyText(form.jsonResult)"
                >{{ $t('monitor:copy') }}</el-button
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
          <el-icon><Warning /></el-icon> {{ $t('monitor:exceptionDetails') }}
        </div>
        <div class="error-body">
          <div class="error-msg">{{ form.errorMsg }}</div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
const { proxy } = getCurrentInstance()

const props = defineProps({
  visible: { type: Boolean, default: false },
  row: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:visible'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const { sys_oper_type } = proxy.useDict('sys_oper_type')

const form = computed(() => props.row || {})
const typeLabel = computed(
  () => proxy.selectDictLabel(sys_oper_type.value, form.value.businessType) || '-'
)

function formatJson(str) {
  if (!str) return t('monitor:noData')
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function copyText(str) {
  const text = formatJson(str)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() =>
      ElMessage({
        get message() {
          return t('monitor:copied')
        },
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
    ElMessage({
      get message() {
        return t('monitor:copied')
      },
      type: 'success',
      duration: 1500,
    })
  }
}
</script>
