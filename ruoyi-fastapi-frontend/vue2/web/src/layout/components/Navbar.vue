<template>
  <div
    class="navbar"
    :class="'nav' + navType"
  >
    <LanguageSelect />
    <hamburger
      id="hamburger-container"
      :is-active="sidebar.opened"
      class="hamburger-container"
      @toggleClick="toggleSideBar"
    />

    <breadcrumb
      v-if="navType == 1"
      id="breadcrumb-container"
      class="breadcrumb-container"
    />
    <top-nav
      v-if="navType == 2"
      id="topmenu-container"
      class="topmenu-container"
    />
    <template v-if="navType == 3">
      <logo
        v-show="showLogo"
        :collapse="false"
      ></logo>
      <top-bar
        id="topbar-container"
        class="topbar-container"
      />
    </template>
    <div class="right-menu">
      <template v-if="device !== 'mobile'">
        <search
          id="header-search"
          class="right-menu-item"
        />

        <el-tooltip
          :content="$t('layout:navbar.source')"
          effect="dark"
          placement="bottom"
        >
          <ruo-yi-git
            id="ruoyi-git"
            class="right-menu-item hover-effect"
          />
        </el-tooltip>

        <el-tooltip
          :content="$t('layout:navbar.docs')"
          effect="dark"
          placement="bottom"
        >
          <ruo-yi-doc
            id="ruoyi-doc"
            class="right-menu-item hover-effect"
          />
        </el-tooltip>

        <screenfull
          id="screenfull"
          class="right-menu-item hover-effect"
        />

        <el-tooltip
          :content="$t('layout:navbar.size')"
          effect="dark"
          placement="bottom"
        >
          <size-select
            id="size-select"
            class="right-menu-item hover-effect"
          />
        </el-tooltip>

        <el-tooltip
          :content="$t('layout:navbar.notices')"
          effect="dark"
          placement="bottom"
        >
          <header-notice
            id="header-notice"
            class="right-menu-item hover-effect"
          />
        </el-tooltip>
      </template>

      <el-dropdown
        class="avatar-container right-menu-item hover-effect"
        trigger="hover"
      >
        <div class="avatar-wrapper">
          <img
            :src="avatar"
            class="user-avatar"
          />
          <span class="user-nickname"> {{ nickName }} </span>
        </div>
        <el-dropdown-menu slot="dropdown">
          <router-link to="/user/profile">
            <el-dropdown-item>{{ $t('layout:routes.profile') }}</el-dropdown-item>
          </router-link>
          <el-dropdown-item
            @click.native="setLayout"
            v-if="setting"
          >
            <span>{{ $t('layout:navbar.settings') }}</span>
          </el-dropdown-item>
          <el-dropdown-item @click.native="lockScreen">
            <span>{{ $t('layout:routes.lock') }}</span>
          </el-dropdown-item>
          <el-dropdown-item
            divided
            @click.native="logout"
          >
            <span>{{ $t('layout:navbar.signOut') }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>
    </div>
  </div>
</template>

<script>
import { t } from '@/i18n/adapter'

import { mapGetters } from 'vuex'
import Breadcrumb from '@/components/Breadcrumb'
import TopNav from './TopNav'
import TopBar from './TopBar'
import Logo from './Sidebar/Logo'
import Hamburger from '@/components/Hamburger'
import Screenfull from '@/components/Screenfull'
import SizeSelect from '@/components/SizeSelect'
import Search from '@/components/HeaderSearch'
import RuoYiGit from '@/components/RuoYi/Git'
import RuoYiDoc from '@/components/RuoYi/Doc'
import HeaderNotice from './HeaderNotice'

export default {
  components: {
    Breadcrumb,
    Logo,
    TopNav,
    TopBar,
    Hamburger,
    Screenfull,
    SizeSelect,
    Search,
    RuoYiGit,
    RuoYiDoc,
    HeaderNotice,
  },
  computed: {
    ...mapGetters(['sidebar', 'avatar', 'device', 'nickName']),
    setting: {
      get() {
        return this.$store.state.settings.showSettings
      },
    },
    navType: {
      get() {
        return this.$store.state.settings.navType
      },
    },
    showLogo: {
      get() {
        return this.$store.state.settings.sidebarLogo
      },
    },
  },
  methods: {
    toggleSideBar() {
      this.$store.dispatch('app/toggleSideBar')
    },
    setLayout(event) {
      this.$emit('setLayout')
    },
    lockScreen() {
      const currentPath = this.$route.fullPath
      this.$store.dispatch('lock/lockScreen', currentPath).then(() => {
        this.$router.push('/lock')
      })
    },
    logout() {
      this.$confirm(t('layout:navbar.signOutConfirm'), t('common:tip'), {
        confirmButtonText: t('common:confirm'),
        cancelButtonText: t('common:cancel'),
        type: 'warning',
      })
        .then(() => {
          this.$store.dispatch('LogOut').then(() => {
            location.href = '/index'
          })
        })
        .catch(() => {})
    },
  },
}
</script>

<style lang="scss" scoped>
.navbar.nav3 {
  .hamburger-container {
    display: none !important;
  }
}

.navbar {
  height: 50px;
  overflow: hidden;
  position: relative;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  // padding: 0 8px;
  box-sizing: border-box;

  .hamburger-container {
    line-height: 46px;
    height: 100%;
    cursor: pointer;
    transition: background 0.3s;
    -webkit-tap-highlight-color: transparent;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-right: 8px;

    &:hover {
      background: rgba(0, 0, 0, 0.025);
    }
  }

  .breadcrumb-container {
    flex-shrink: 0;
  }

  .topmenu-container {
    position: absolute;
    left: 50px;
  }

  .topbar-container {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    overflow: hidden;
    margin-left: 8px;
  }

  .right-menu {
    height: 100%;
    line-height: 50px;
    display: flex;
    align-items: center;
    margin-left: auto;

    &:focus {
      outline: none;
    }

    .right-menu-item {
      display: inline-block;
      padding: 0 8px;
      height: 100%;
      font-size: 18px;
      color: #5a5e66;
      vertical-align: text-bottom;

      &.hover-effect {
        cursor: pointer;
        transition: background 0.3s;

        &:hover {
          background: rgba(0, 0, 0, 0.025);
        }
      }
    }

    .avatar-container {
      margin-right: 0px;
      padding-right: 0px;

      .avatar-wrapper {
        // margin-top: 10px;
        right: 8px;
        position: relative;

        .user-avatar {
          cursor: pointer;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          vertical-align: middle;
          border-style: none;
        }

        .user-nickname {
          position: relative;
          // bottom: 10px;
          left: 2px;
          font-size: 14px;
          font-weight: bold;
        }

        .el-icon-caret-bottom {
          cursor: pointer;
          position: absolute;
          right: -20px;
          top: 25px;
          font-size: 12px;
        }
      }
    }
  }
}
</style>
