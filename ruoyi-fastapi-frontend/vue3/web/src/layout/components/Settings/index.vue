<template>
  <el-drawer
    v-model="showSettings"
    :withHeader="false"
    :lock-scroll="false"
    direction="rtl"
    size="min(360px, 100vw)"
  >
    <div class="setting-drawer-title">
      <h3 class="drawer-title">{{ $t('layout:settings.navigation') }}</h3>
    </div>
    <div class="nav-wrap">
      <el-tooltip
        :content="$t('layout:settings.sidebar')"
        placement="bottom"
      >
        <div
          class="item left"
          @click="handleNavType(1)"
          :class="{ activeItem: navType == 1 }"
        >
          <b></b><b></b>
        </div>
      </el-tooltip>

      <el-tooltip
        :content="$t('layout:settings.mixed')"
        placement="bottom"
      >
        <div
          class="item mix"
          @click="handleNavType(2)"
          :class="{ activeItem: navType == 2 }"
        >
          <b></b><b></b>
        </div>
      </el-tooltip>
      <el-tooltip
        :content="$t('layout:settings.top')"
        placement="bottom"
      >
        <div
          class="item top"
          @click="handleNavType(3)"
          :class="{ activeItem: navType == 3 }"
        >
          <b></b><b></b>
        </div>
      </el-tooltip>
    </div>
    <div class="setting-drawer-title">
      <h3 class="drawer-title">{{ $t('layout:settings.theme') }}</h3>
    </div>
    <div class="setting-drawer-block-checbox">
      <div
        class="setting-drawer-block-checbox-item"
        @click="handleTheme('theme-dark')"
      >
        <img
          src="@/assets/images/dark.svg"
          :alt="$t('layout:settings.dark')"
        />
        <div
          v-if="sideTheme === 'theme-dark'"
          class="setting-drawer-block-checbox-selectIcon"
          style="display: block"
        >
          <i
            :aria-label="$t('layout:settings.selected')"
            class="anticon anticon-check"
          >
            <svg
              viewBox="64 64 896 896"
              data-icon="check"
              width="1em"
              height="1em"
              :fill="theme"
              aria-hidden="true"
              focusable="false"
              class
            >
              <path
                d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z"
              />
            </svg>
          </i>
        </div>
      </div>
      <div
        class="setting-drawer-block-checbox-item"
        @click="handleTheme('theme-light')"
      >
        <img
          src="@/assets/images/light.svg"
          :alt="$t('layout:settings.light')"
        />
        <div
          v-if="sideTheme === 'theme-light'"
          class="setting-drawer-block-checbox-selectIcon"
          style="display: block"
        >
          <i
            :aria-label="$t('layout:settings.selected')"
            class="anticon anticon-check"
          >
            <svg
              viewBox="64 64 896 896"
              data-icon="check"
              width="1em"
              height="1em"
              :fill="theme"
              aria-hidden="true"
              focusable="false"
              class
            >
              <path
                d="M912 190h-69.9c-9.8 0-19.1 4.5-25.1 12.2L404.7 724.5 207 474a32 32 0 0 0-25.1-12.2H112c-6.7 0-10.4 7.7-6.3 12.9l273.9 347c12.8 16.2 37.4 16.2 50.3 0l488.4-618.9c4.1-5.1.4-12.8-6.3-12.8z"
              />
            </svg>
          </i>
        </div>
      </div>
    </div>
    <div class="drawer-item">
      <span>{{ $t('layout:settings.color') }}</span>
      <span class="comp-style">
        <el-color-picker
          v-model="theme"
          :predefine="predefineColors"
          @change="themeChange"
        />
      </span>
    </div>
    <el-divider />

    <h3 class="drawer-title">{{ $t('layout:settings.layout') }}</h3>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.tabs') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.tagsView"
          class="drawer-switch"
        />
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.persistTabs') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.tagsViewPersist"
          :disabled="!settingsStore.tagsView"
          @change="tagsViewPersistChange"
          class="drawer-switch"
        />
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.tabIcons') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.tagsIcon"
          :disabled="!settingsStore.tagsView"
          class="drawer-switch"
        />
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.tabStyle') }}</span>
      <span class="comp-style">
        <el-radio-group
          v-model="settingsStore.tagsViewStyle"
          :disabled="!settingsStore.tagsView"
          size="small"
        >
          <el-radio-button label="card">{{ $t('layout:settings.card') }}</el-radio-button>
          <el-radio-button label="chrome">{{ $t('layout:settings.chrome') }}</el-radio-button>
        </el-radio-group>
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.fixedHeader') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.fixedHeader"
          class="drawer-switch"
        />
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.logo') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.sidebarLogo"
          class="drawer-switch"
        />
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.dynamicTitle') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.dynamicTitle"
          class="drawer-switch"
        />
      </span>
    </div>

    <div class="drawer-item">
      <span>{{ $t('layout:settings.footer') }}</span>
      <span class="comp-style">
        <el-switch
          v-model="settingsStore.footerVisible"
          class="drawer-switch"
        />
      </span>
    </div>

    <el-divider />

    <el-button
      type="primary"
      plain
      icon="DocumentAdd"
      @click="saveSetting"
      >{{ $t('layout:settings.save') }}</el-button
    >
    <el-button
      plain
      icon="Refresh"
      @click="resetSetting"
      >{{ $t('layout:settings.reset') }}</el-button
    >
  </el-drawer>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import useAppStore from '@/store/modules/app'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'
import { handleThemeStyle } from '@/utils/theme'

const { proxy } = getCurrentInstance()
const appStore = useAppStore()
const settingsStore = useSettingsStore()
const permissionStore = usePermissionStore()
const showSettings = ref(false)
const navType = ref(settingsStore.navType)
const theme = ref(settingsStore.theme)
const sideTheme = ref(settingsStore.sideTheme)
const tagsViewPersist = ref(settingsStore.tagsViewPersist)
const storeSettings = computed(() => settingsStore)
const predefineColors = ref([
  '#409EFF',
  '#ff4500',
  '#ff8c00',
  '#ffd700',
  '#90ee90',
  '#00ced1',
  '#1e90ff',
  '#c71585',
])

function tagsViewPersistChange(val) {
  settingsStore.tagsViewPersist = val
  tagsViewPersist.value = val
}

function themeChange(val) {
  settingsStore.theme = val
  handleThemeStyle(val)
}

function handleTheme(val) {
  settingsStore.sideTheme = val
  sideTheme.value = val
}

function handleNavType(val) {
  settingsStore.navType = val
  navType.value = val
}

/** 菜单导航设置 */
watch(
  () => navType,
  (val) => {
    if (val.value == 1) {
      appStore.sidebar.opened = true
      appStore.toggleSideBarHide(false)
    }
    if (val.value == 2) {
      appStore.sidebar.opened = true
    }
    if (val.value == 3) {
      appStore.sidebar.opened = false
      appStore.toggleSideBarHide(true)
    }
    if ([1, 3].includes(val.value)) {
      permissionStore.setSidebarRouters(permissionStore.defaultRoutes)
    }
  },
  { immediate: true, deep: true }
)

function saveSetting() {
  proxy.$modal.loading(t('layout:settings.saving'))
  if (!tagsViewPersist.value) {
    proxy.$cache.local.remove('tags-view-visited')
  }
  let layoutSetting = {
    navType: storeSettings.value.navType,
    tagsView: storeSettings.value.tagsView,
    tagsIcon: storeSettings.value.tagsIcon,
    tagsViewStyle: storeSettings.value.tagsViewStyle,
    tagsViewPersist: storeSettings.value.tagsViewPersist,
    fixedHeader: storeSettings.value.fixedHeader,
    sidebarLogo: storeSettings.value.sidebarLogo,
    dynamicTitle: storeSettings.value.dynamicTitle,
    footerVisible: storeSettings.value.footerVisible,
    sideTheme: storeSettings.value.sideTheme,
    theme: storeSettings.value.theme,
  }
  localStorage.setItem('layout-setting', JSON.stringify(layoutSetting))
  setTimeout(proxy.$modal.closeLoading(), 1000)
}

function resetSetting() {
  proxy.$cache.local.remove('tags-view-visited')
  proxy.$modal.loading(t('layout:settings.resetting'))
  localStorage.removeItem('layout-setting')
  setTimeout('window.location.reload()', 1000)
}

function openSetting() {
  showSettings.value = true
}

defineExpose({
  openSetting,
})
</script>

<style lang="scss" scoped>
.setting-drawer-title {
  margin-bottom: 12px;
  color: var(--el-text-color-primary, rgba(0, 0, 0, 0.85));
  line-height: 22px;
  font-weight: bold;

  .drawer-title {
    font-size: 14px;
  }
}

.setting-drawer-block-checbox {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 10px;
  margin-bottom: 20px;

  .setting-drawer-block-checbox-item {
    position: relative;
    margin-right: 16px;
    border-radius: 2px;
    cursor: pointer;

    img {
      width: 48px;
      height: 48px;
    }

    .setting-drawer-block-checbox-selectIcon {
      position: absolute;
      top: 0;
      right: 0;
      width: 100%;
      height: 100%;
      padding-top: 15px;
      padding-left: 24px;
      color: #1890ff;
      font-weight: 700;
      font-size: 14px;
    }
  }
}

.drawer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--el-text-color-regular, rgba(0, 0, 0, 0.65));
  padding: 12px 0;
  font-size: 14px;

  .comp-style {
    flex-shrink: 0;
  }
}

// 导航模式
.nav-wrap {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 10px;
  margin-bottom: 20px;

  .activeItem {
    border: 2px solid var(--el-color-primary) !important;
  }

  .item {
    position: relative;
    margin-right: 16px;
    cursor: pointer;
    width: 56px;
    height: 48px;
    border-radius: 4px;
    background: #f0f2f5;
    border: 2px solid transparent;
  }

  .left {
    b:first-child {
      display: block;
      height: 30%;
      background: #fff;
    }
    b:last-child {
      width: 30%;
      background: #1b2a47;
      position: absolute;
      height: 100%;
      top: 0;
      border-radius: 4px 0 0 4px;
    }
  }
  .mix {
    b:first-child {
      border-radius: 4px 4px 0 0;
      display: block;
      height: 30%;
      background: #1b2a47;
    }
    b:last-child {
      width: 30%;
      background: #1b2a47;
      position: absolute;
      height: 70%;
      border-radius: 0 0 0 4px;
    }
  }
  .top {
    b:first-child {
      display: block;
      height: 30%;
      background: #1b2a47;
      border-radius: 4px 4px 0 0;
    }
  }
}
</style>
