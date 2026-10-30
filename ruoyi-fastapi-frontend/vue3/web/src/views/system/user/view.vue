<template>
  <el-drawer
    :title="$t('system:userDetails')"
    v-model="visible"
    direction="rtl"
    size="68%"
    append-to-body
    :before-close="handleClose"
    class="detail-drawer"
  >
    <div
      v-loading="loading"
      class="drawer-content"
    >
      <!-- 基本信息 -->
      <h4 class="section-header">{{ $t('system:basicInformation') }}</h4>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:userNameLabel') }}</label>
            <span class="info-value plaintext">{{ info.nickName }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:departmentLabelText') }}</label>
            <span class="info-value plaintext">{{ info.dept && info.dept.deptName }}</span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:phoneNumberLabel') }}</label>
            <span class="info-value plaintext">{{ info.phonenumber }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:emailLabel') }}</label>
            <span class="info-value plaintext">{{ info.email }}</span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:loginAccountLabel') }}</label>
            <span class="info-value plaintext">{{ info.userName }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:userStatusLabel') }}</label>
            <span class="info-value plaintext">
              <el-tag
                size="small"
                :type="info.status === '0' ? 'success' : 'danger'"
                >{{
                  info.status === '0' ? $t('layout:notices.active') : $t('system:disabled')
                }}</el-tag
              >
            </span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:postLabel') }}</label>
            <span class="info-value plaintext">{{ postNames || $t('system:profile.noPost') }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:genderLabelText') }}</label>
            <span class="info-value plaintext">{{ sexLabel }}</span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="24">
          <div class="info-item full-width">
            <label class="info-label">{{ $t('system:roleLabel') }}</label>
            <span class="info-value plaintext">{{ roleNames || $t('system:profile.noRole') }}</span>
          </div>
        </el-col>
      </el-row>
      <!-- 其他信息 -->
      <h4 class="section-header">{{ $t('system:otherInformation') }}</h4>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:createdByLabel') }}</label>
            <span class="info-value plaintext">{{ info.createBy }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:createdAtLabel') }}</label>
            <span class="info-value plaintext">{{ parseTime(info.createTime) }}</span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:updatedBy') }}</label>
            <span class="info-value plaintext">{{ info.updateBy }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:updatedAt') }}</label>
            <span class="info-value plaintext">{{ parseTime(info.updateTime) }}</span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:lastSignInIP') }}</label>
            <span class="info-value plaintext">{{ info.loginIp }}</span>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="info-item">
            <label class="info-label">{{ $t('system:lastSignInTime') }}</label>
            <span class="info-value plaintext">{{ parseTime(info.loginDate) }}</span>
          </div>
        </el-col>
      </el-row>
      <el-row
        :gutter="20"
        class="mb8"
      >
        <el-col :span="24">
          <div class="info-item full-width">
            <label class="info-label">{{ $t('system:remarksLabel') }}</label>
            <span class="info-value plaintext">{{ info.remark }}</span>
          </div>
        </el-col>
      </el-row>
    </div>
  </el-drawer>
</template>

<script setup>
import { getUser } from '@/api/system/user'

const visible = ref(false)
const loading = ref(false)
const info = reactive({})
const postOptions = ref([])
const roleOptions = ref([])
const { proxy } = getCurrentInstance()

const { sys_user_sex } = proxy.useDict('sys_user_sex')

const sexLabel = computed(() => proxy.selectDictLabel(sys_user_sex.value, info.sex) || '-')

const postNames = computed(() => {
  if (!postOptions.value.length || !info.postIds) return ''
  return (
    postOptions.value
      .filter((p) => info.postIds?.includes(p.postId))
      .map((p) => p.postName)
      .join('、') || ''
  )
})

const roleNames = computed(() => {
  if (!roleOptions.value.length || !info.roleIds) return ''
  return (
    roleOptions.value
      .filter((r) => info.roleIds?.includes(r.roleId))
      .map((r) => r.roleName)
      .join('、') || ''
  )
})

const open = async (userId) => {
  visible.value = true
  loading.value = true
  try {
    const res = await getUser(userId)
    Object.assign(info, res.data || {})
    postOptions.value = res.posts || []
    roleOptions.value = res.roles || []
    info.postIds = res.postIds || []
    info.roleIds = res.roleIds || []
  } catch (error) {
    console.error('获取用户信息失败:', error)
  } finally {
    loading.value = false
  }
}

function handleClose() {
  visible.value = false
}

defineExpose({
  open,
})
</script>
