<template>
  <div class="access-map">
    <div class="access-node">
      <span class="node-label">{{ $t('components:apply') }}</span>
      <strong>{{ application || $t('components:unnamed') }}</strong>
      <small>{{ applicationType }}</small>
    </div>
    <div
      class="access-link"
      aria-hidden="true"
    >
      <span>{{ $t('components:requests') }}</span>
      <el-icon><right /></el-icon>
    </div>
    <div class="access-node">
      <span class="node-label">{{ $t('components:permissions') }}</span>
      <strong>{{ permissionSummary }}</strong>
      <small>{{ permissionHint }}</small>
    </div>
    <div
      class="access-link"
      aria-hidden="true"
    >
      <span>{{ $t('components:access') }}</span>
      <el-icon><right /></el-icon>
    </div>
    <div class="access-node">
      <span class="node-label">{{ $t('components:service') }}</span>
      <strong>{{ resourceSummary }}</strong>
      <small>{{ resourceHint }}</small>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n/adapter'
const props = defineProps({
  application: { type: String, default: '' },
  type: { type: String, default: 'confidential' },
  permissions: { type: Array, default: () => [] },
  resources: { type: Array, default: () => [] },
})

const applicationType = computed(() =>
  props.type === 'public'
    ? t('components:webOrMobileApplication')
    : t('components:backendServiceApplication')
)
const permissionSummary = computed(
  () => props.permissions.slice(0, 2).join('、') || t('components:notSelected')
)
const permissionHint = computed(() =>
  props.permissions.length > 2
    ? t('components:valueMorePermissions', { arg0: props.permissions.length - 2 })
    : t('components:informationTheApplicationCanRequest')
)
const resourceSummary = computed(
  () => props.resources.slice(0, 2).join('、') || t('components:identityInformationOnly')
)
const resourceHint = computed(() =>
  props.resources.length > 2
    ? t('components:valueMoreServices', { arg0: props.resources.length - 2 })
    : t('components:resourcesTheTokenCanAccess')
)
</script>

<style scoped>
.access-map {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 84px minmax(0, 1fr) 84px minmax(0, 1fr);
  align-items: stretch;
}

.access-node {
  min-width: 0;
  padding: 14px 16px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.node-label {
  display: block;
  margin-bottom: 7px;
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.access-node strong,
.access-node small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-node strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.access-node small {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.access-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@media (max-width: 768px) {
  .access-map {
    grid-template-columns: 1fr;
  }

  .access-link {
    min-height: 34px;
    transform: rotate(90deg);
  }
}
</style>
