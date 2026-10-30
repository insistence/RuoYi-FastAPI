<template>
  <div class="app-container">
    <el-row :gutter="20">
      <el-col
        :span="6"
        :xs="24"
      >
        <el-card class="box-card">
          <div
            slot="header"
            class="clearfix"
          >
            <span>{{ $t('system:profile') }}</span>
          </div>
          <div>
            <div class="text-center">
              <userAvatar />
            </div>
            <ul class="list-group list-group-striped">
              <li class="list-group-item">
                <svg-icon icon-class="user" />{{ $t('system:user.username') }}
                <div class="pull-right">{{ user.userName }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="phone" />{{ $t('system:user.phone') }}
                <div class="pull-right">{{ user.phonenumber }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="email" />{{ $t('system:userEmail') }}
                <div class="pull-right">{{ user.email }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="tree" />{{ $t('system:user.department') }}
                <div
                  class="pull-right"
                  v-if="user.dept"
                >
                  {{ user.dept.deptName }} / {{ postGroup }}
                </div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="peoples" />{{ $t('system:roles') }}
                <div class="pull-right">{{ roleGroup }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="date" />{{ $t('common:createdDate') }}
                <div class="pull-right">{{ parseTime(user.createTime) || '-' }}</div>
              </li>
            </ul>
          </div>
        </el-card>
      </el-col>
      <el-col
        :span="18"
        :xs="24"
      >
        <el-card>
          <div
            slot="header"
            class="clearfix"
          >
            <span>{{ $t('system:basicProfile') }}</span>
          </div>
          <el-tabs v-model="selectedTab">
            <el-tab-pane
              :label="$t('system:basicProfile')"
              name="userinfo"
            >
              <userInfo :user="user" />
            </el-tab-pane>
            <el-tab-pane
              :label="$t('system:user.changePassword')"
              name="resetPwd"
            >
              <resetPwd />
            </el-tab-pane>
            <el-tab-pane
              :label="$t('system:user.timeZoneSettings')"
              name="timezone"
            >
              <timezoneSettings
                :user="user"
                @saved="$set(user, 'timeZone', $event)"
              />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import timezoneSettings from './timezoneSettings.vue'
import userAvatar from './userAvatar'
import userInfo from './userInfo'
import resetPwd from './resetPwd'
import { getUserProfile } from '@/api/system/user'

export default {
  name: 'Profile',
  components: { userAvatar, userInfo, resetPwd, timezoneSettings },
  data() {
    return {
      user: {},
      roleGroup: {},
      postGroup: {},
      selectedTab: 'userinfo',
    }
  },
  created() {
    const activeTab = this.$route.params && this.$route.params.activeTab
    if (activeTab) {
      this.selectedTab = activeTab
    }
    this.getUser()
  },
  methods: {
    getUser() {
      getUserProfile().then((response) => {
        this.user = response.data
        this.$store.dispatch('ApplyTimezone', response.data.timeZone)
        this.roleGroup = response.roleGroup
        this.postGroup = response.postGroup
      })
    },
  },
}
</script>
