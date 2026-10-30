<template>
  <el-drawer
    :title="$t('system:userDetails')"
    :visible.sync="visible"
    direction="rtl"
    size="68%"
    append-to-body
    :before-close="handleClose"
    custom-class="detail-drawer"
  >
    <div
      v-loading="loading"
      class="drawer-content"
    >
      <!-- 基本信息 -->
      <h4 class="section-header">{{ $t('common:basicInfo') }}</h4>
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
                  info.status === '0' ? $t('layout:notices.active') : $t('system:oauth.disabled')
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
            <span class="info-value plaintext">{{
              postNames || $t('common:expression.noPosts')
            }}</span>
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
            <span class="info-value plaintext">{{
              roleNames || $t('common:expression.noRoles')
            }}</span>
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

<script>
import { getUser } from '@/api/system/user'

export default {
  name: 'UserViewDrawer',
  dicts: ['sys_user_sex'],
  data() {
    return {
      visible: false,
      loading: false,
      info: {},
      postOptions: [],
      roleOptions: [],
    }
  },
  computed: {
    sexLabel() {
      return this.selectDictLabel(this.dict.type.sys_user_sex, this.info.sex) || '-'
    },
    postNames() {
      if (!this.postOptions.length) return ''
      const ids = this.info.postIds || []
      return (
        this.postOptions
          .filter((p) => ids.includes(p.postId))
          .map((p) => p.postName)
          .join('、') || ''
      )
    },
    roleNames() {
      if (!this.roleOptions.length) return ''
      const ids = this.info.roleIds || []
      return (
        this.roleOptions
          .filter((r) => ids.includes(r.roleId))
          .map((r) => r.roleName)
          .join('、') || ''
      )
    },
  },
  methods: {
    open(userId) {
      this.visible = true
      this.loading = true
      getUser(userId)
        .then((res) => {
          this.info = res.data || {}
          this.postOptions = res.posts || []
          this.roleOptions = res.roles || []
          this.info.postIds = res.postIds || []
          this.info.roleIds = res.roleIds || []
        })
        .finally(() => {
          this.loading = false
        })
    },
    handleClose() {
      this.visible = false
    },
  },
}
</script>
