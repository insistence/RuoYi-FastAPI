<template>
  <div class="app-container">
    <el-row :gutter="20">
      <el-col
        :span="6"
        :xs="24"
      >
        <el-card class="box-card">
          <template v-slot:header>
            <div class="clearfix">
              <span>{{ $t('system:profile') }}</span>
            </div>
          </template>
          <div>
            <div class="text-center">
              <userAvatar />
            </div>
            <ul class="list-group list-group-striped">
              <li class="list-group-item">
                <svg-icon icon-class="user" />{{ $t('system:userName') }}
                <div class="pull-right">{{ state.user.userName }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="phone" />{{ $t('system:phoneNumber') }}
                <div class="pull-right">{{ state.user.phonenumber }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="email" />{{ $t('system:userEmail') }}
                <div class="pull-right">{{ state.user.email }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="tree" />{{ $t('system:department') }}
                <div
                  class="pull-right"
                  v-if="state.user.dept"
                >
                  {{ state.user.dept.deptName }} / {{ state.postGroup }}
                </div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="peoples" />{{ $t('system:roles') }}
                <div class="pull-right">{{ state.roleGroup }}</div>
              </li>
              <li class="list-group-item">
                <svg-icon icon-class="date" />{{ $t('system:createdOn') }}
                <div class="pull-right">{{ parseTime(state.user.createTime) || '-' }}</div>
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
          <template v-slot:header>
            <div class="clearfix">
              <span>{{ $t('system:basicProfile') }}</span>
            </div>
          </template>
          <el-tabs v-model="selectedTab">
            <el-tab-pane
              :label="$t('system:basicProfile')"
              name="userinfo"
            >
              <userInfo :user="state.user" />
            </el-tab-pane>
            <el-tab-pane
              :label="$t('system:changePassword')"
              name="resetPwd"
            >
              <resetPwd />
            </el-tab-pane>
            <el-tab-pane
              :label="$t('system:timeZone')"
              name="timezone"
            >
              <timezoneSettings
                :user="state.user"
                @saved="state.user.timeZone = $event"
              />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Profile">
import userAvatar from './userAvatar'
import userInfo from './userInfo'
import resetPwd from './resetPwd'
import timezoneSettings from './timezoneSettings.vue'
import useUserStore from '@/store/modules/user'
import { getUserProfile } from '@/api/system/user'

const route = useRoute()
const selectedTab = ref('userinfo')
const state = reactive({
  user: {},
  roleGroup: {},
  postGroup: {},
})

function getUser() {
  getUserProfile().then((response) => {
    state.user = response.data
    useUserStore().applyTimezone(response.data.timeZone)
    state.roleGroup = response.roleGroup
    state.postGroup = response.postGroup
  })
}

onMounted(() => {
  const activeTab = route.params && route.params.activeTab
  if (activeTab) {
    selectedTab.value = activeTab
  }
  getUser()
})
</script>
