<template>
  <div class="header-search">
    <svg-icon
      class-name="search-icon"
      icon-class="search"
      @click.stop="click"
    />
    <el-dialog
      v-model="show"
      width="min(600px, calc(100vw - 32px))"
      @close="close"
      @opened="onDialogOpened"
      :show-close="false"
      append-to-body
    >
      <el-input
        v-model="search"
        ref="headerSearchSelectRef"
        size="large"
        @input="querySearch"
        prefix-icon="Search"
        :placeholder="$t('layout:search.placeholder')"
        clearable
        @keyup.enter="selectActiveResult"
        @keydown.up.prevent="navigateResult('up')"
        @keydown.down.prevent="navigateResult('down')"
      >
      </el-input>

      <div
        class="result-count"
        v-if="search && options.length > 0"
      >
        {{ $t('layout:search.results', { count: options.length }) }}
      </div>

      <div class="result-wrap">
        <el-scrollbar>
          <template v-if="options.length > 0">
            <div
              class="search-item"
              tabindex="1"
              v-for="(item, index) in options"
              :key="item.path"
              :class="{ 'is-active': index === activeIndex }"
              :style="activeStyle(index)"
              @mouseenter="activeIndex = index"
              @mouseleave="activeIndex = -1"
            >
              <div class="left">
                <svg-icon
                  class="menu-icon"
                  :icon-class="item.icon"
                />
              </div>
              <div
                class="search-info"
                @click="change(item)"
              >
                <div class="menu-title">
                  <span
                    v-for="(part, partIndex) in highlightText(item.title.join(' / '))"
                    :key="partIndex"
                    :class="{ highlight: part.matched }"
                    >{{ part.text }}</span
                  >
                </div>
                <div class="menu-path">
                  <span
                    v-for="(part, partIndex) in highlightText(item.path)"
                    :key="partIndex"
                    :class="{ highlight: part.matched }"
                    >{{ part.text }}</span
                  >
                </div>
              </div>
              <svg-icon
                icon-class="enter"
                v-show="index === activeIndex"
              />
            </div>
          </template>

          <div
            class="empty-state"
            v-else-if="search && options.length === 0"
          >
            <el-icon class="empty-icon"><Search /></el-icon>
            <p class="empty-text">
              {{ $t('layout:search.noResults', { query: search }) }}
            </p>
            <p class="empty-tip">{{ $t('layout:search.tryAgain') }}</p>
          </div>
        </el-scrollbar>
      </div>

      <div class="search-footer">
        <span class="shortcut-item">
          <kbd>↑</kbd><kbd>↓</kbd> {{ $t('layout:search.navigate') }}
        </span>
        <span class="shortcut-item"> <kbd>↵</kbd> {{ $t('layout:search.select') }} </span>
        <span class="shortcut-item"> <kbd>Esc</kbd> {{ $t('layout:search.close') }} </span>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import Fuse from 'fuse.js'
import { resolveRouteTitle } from '@/i18n/adapter'
import { getNormalPath } from '@/utils/ruoyi'
import { isHttp } from '@/utils/validate'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'

const search = ref('')
const options = ref([])
const activeIndex = ref(-1)
const show = ref(false)
const fuse = ref(undefined)
const headerSearchSelectRef = ref(null)
const router = useRouter()
const theme = computed(() => useSettingsStore().theme)
const routes = computed(() => usePermissionStore().defaultRoutes)
const searchPool = computed(() => generateRoutes(routes.value))

function click() {
  show.value = !show.value
  if (show.value) {
    options.value = searchPool.value
  }
}

function onDialogOpened() {
  nextTick(() => {
    headerSearchSelectRef.value && headerSearchSelectRef.value.focus()
  })
}

function close() {
  headerSearchSelectRef.value && headerSearchSelectRef.value.blur()
  search.value = ''
  options.value = searchPool.value
  show.value = false
  activeIndex.value = -1
}

function change(val) {
  const p = val.path
  const query = val.query
  if (isHttp(p)) {
    // http(s):// 路径新窗口打开
    const pindex = p.indexOf('http')
    window.open(p.substr(pindex, p.length), '_blank')
  } else {
    if (query) {
      router.push({ path: p, query: JSON.parse(query) })
    } else {
      router.push(p)
    }
  }
  search.value = ''
  options.value = searchPool.value
  nextTick(() => {
    show.value = false
  })
}

function initFuse(list) {
  fuse.value = new Fuse(list, {
    shouldSort: true,
    threshold: 0.2,
    distance: 100,
    minMatchCharLength: 1,
    keys: [
      {
        name: 'title',
        weight: 0.7,
      },
      {
        name: 'path',
        weight: 0.3,
      },
    ],
  })
}

function generateRoutes(routes, basePath = '', prefixTitle = []) {
  let res = []
  for (const r of routes) {
    if (r.hidden) {
      continue
    }
    const p = r.path.length > 0 && r.path[0] === '/' ? r.path : '/' + r.path
    const data = {
      path: !isHttp(r.path) ? getNormalPath(basePath + p) : r.path,
      title: [...prefixTitle],
      icon: '',
    }
    if (r.meta && (r.meta.title || r.meta.titleKey)) {
      data.title = [...data.title, resolveRouteTitle(r)]
      data.icon = r.meta.icon
      if (r.redirect !== 'noRedirect') {
        res.push(data)
      }
    }
    if (r.query) {
      data.query = r.query
    }
    if (r.children) {
      const tempRoutes = generateRoutes(r.children, data.path, data.title)
      if (tempRoutes.length >= 1) {
        res = [...res, ...tempRoutes]
      }
    }
  }
  return res
}

function querySearch(query) {
  activeIndex.value = -1
  if (query !== '') {
    const q = query.toLowerCase()
    const pathMatches = searchPool.value.filter((item) => item.path.toLowerCase().includes(q))
    const fuseMatches = fuse.value.search(query).map((item) => item.item)
    const merged = [...pathMatches]
    fuseMatches.forEach((item) => {
      if (!merged.find((m) => m.path === item.path)) {
        merged.push(item)
      }
    })
    options.value = merged
  } else {
    options.value = searchPool.value
  }
}

function activeStyle(index) {
  if (index !== activeIndex.value) return {}
  return {
    'background-color': theme.value,
    color: '#fff',
  }
}

function navigateResult(direction) {
  if (direction === 'up') {
    activeIndex.value = activeIndex.value <= 0 ? options.value.length - 1 : activeIndex.value - 1
  } else if (direction === 'down') {
    activeIndex.value = activeIndex.value >= options.value.length - 1 ? 0 : activeIndex.value + 1
  }
}

function selectActiveResult() {
  if (options.value.length > 0 && activeIndex.value >= 0) {
    change(options.value[activeIndex.value])
  }
}

function highlightText(text) {
  if (!search.value) return [{ text, matched: false }]
  const keyword = escapeRegExp(search.value)
  const reg = new RegExp(`(${keyword})`, 'gi')
  return text.split(reg).map((part, index) => ({ text: part, matched: index % 2 === 1 }))
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

watch(
  searchPool,
  (list) => {
    initFuse(list)
    querySearch(search.value)
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
:deep(.el-dialog__header) {
  padding: 6px !important;
}

:deep(.highlight) {
  color: red;
  font-weight: 600;
}

:deep(.is-active .highlight) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.header-search {
  .search-icon {
    cursor: pointer;
    font-size: 18px;
    vertical-align: middle;
  }
}

.result-count {
  padding: 6px 16px 0;
  font-size: 12px;
  color: #aaa;

  strong {
    color: red;
    font-weight: 600;
  }
}

.result-wrap {
  height: 280px;
  margin: 4px 0;

  .search-item {
    display: flex;
    height: 48px;
    align-items: center;
    padding-right: 10px;
    border-radius: 4px;
    transition: background 0.15s;

    .left {
      width: 60px;
      text-align: center;
      flex-shrink: 0;

      .menu-icon {
        width: 18px;
        height: 18px;
      }
    }

    .search-info {
      padding-left: 5px;
      margin-top: 10px;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      flex: 1;
      overflow: hidden;

      .menu-title,
      .menu-path {
        height: 20px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .menu-path {
        color: #ccc;
        font-size: 10px;
      }
    }
  }

  .search-item:hover {
    cursor: pointer;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;

    .empty-icon {
      font-size: 42px;
      color: #e0e0e0;
      margin-bottom: 14px;
    }

    .empty-text {
      font-size: 14px;
      color: #999;
      margin: 0 0 6px;

      strong {
        color: #666;
      }
    }

    .empty-tip {
      font-size: 12px;
      color: #bbb;
      margin: 0;
    }
  }
}

.search-footer {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 10px 20px;
  border-top: 1px solid #f0f0f0;
  color: #999;
  font-size: 12px;

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f7f7f7;
    color: #555;
    font-size: 11px;
    font-family: inherit;
    line-height: 1;
    box-shadow: 0 1px 0 #ccc;
  }
}
</style>
