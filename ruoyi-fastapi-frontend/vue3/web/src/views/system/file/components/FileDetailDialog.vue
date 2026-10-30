<template>
  <el-dialog
    :title="$t('files:fileDetails')"
    v-model="open"
    width="820px"
    append-to-body
  >
    <el-descriptions
      :column="2"
      border
      label-width="110px"
      class="file-descriptions"
    >
      <el-descriptions-item
        :label="$t('files:fileID')"
        :span="2"
      >
        {{ detail.fileId }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('components:originalFileName')">
        {{ detail.originalName }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:storedFileName')">
        {{ detail.storedName }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('components:accessType')">
        {{ accessTypeLabel(detail.accessType) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:fileStatus')">
        {{ statusLabel(detail.status) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:uploader')">
        {{ detail.createBy || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:uploaderID')">
        {{ detail.uploadUserId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:uploaderPermissions')">
        <el-tag
          v-if="detail.accessType === 'private' && detail.uploadUserId"
          :type="uploaderPermissionTagType(detail)"
          effect="plain"
        >
          {{ uploaderPermissionLabel(detail) }}
        </el-tag>
        <span v-else>{{ uploaderPermissionLabel(detail) }}</span>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('components:owner')">
        {{ detail.ownerName || detail.ownerUserId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('system:department')">
        {{ detail.deptName || detail.deptId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:storageStatus')">
        {{ storageStatusLabel(detail.storageStatus) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:aCLEntries')">
        {{ detail.aclEntryCount || 0 }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:businessReferences')">
        <el-button
          v-if="detail.referenceCount"
          link
          type="primary"
          @click="emit('reference', detail)"
        >
          {{ detail.referenceCount }} {{ $t('authCenter:items') }}</el-button
        >
        <span v-else>{{ $t('files:0Items') }}</span>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:permissionsVersion')">
        {{ detail.aclVersion ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('tools:fileSize')">
        {{ formatFileSize(detail.fileSize) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:contentType')">
        {{ detail.contentType || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:extension')">
        {{ detail.extension || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:uploadedAt')">
        {{ parseTime(detail.createTime) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:expiresAt')">
        {{ parseTime(detail.expireTime) || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('files:moveToRecycleBin')">
        {{ parseTime(detail.deletedTime) || '-' }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="$t('files:relativeStoragePath')"
        :span="2"
      >
        {{ detail.storageKey }}
      </el-descriptions-item>
      <el-descriptions-item
        label="SHA-256"
        :span="2"
      >
        <span class="file-hash">{{ detail.fileHash }}</span>
      </el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="open = false">{{ $t('monitor:close') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { accessTypeLabel, formatFileSize, statusLabel, storageStatusLabel } from './fileFormatters'

defineProps({
  detail: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['reference'])
const open = defineModel({
  type: Boolean,
  default: false,
})

function uploaderPermissionLabel(file) {
  if (file.accessType !== 'private') {
    return t('files:publicFilesDoNotRequireIndividualPermissions')
  }
  if (!file.uploadUserId) {
    return t('files:uploaderNotRecorded')
  }
  const accessEnabled = file.uploaderAccessEnabled === '1' || file.uploaderAccessEnabled === true
  if (file.uploadUserId === file.ownerUserId) {
    return accessEnabled
      ? t('files:legacyAccessRetainedAlsoTheOwner')
      : t('files:legacyAccessRemovedAccessRemainsThroughOwnership')
  }
  return accessEnabled
    ? t('files:retainedAnExplicitDenyTakesPrecedence')
    : t('files:removedUploadingTheFileNoLongerGrantsAccess')
}

function uploaderPermissionTagType(file) {
  if (file.uploaderAccessEnabled !== '1' && file.uploaderAccessEnabled !== true) {
    return 'info'
  }
  return file.uploadUserId === file.ownerUserId ? 'primary' : 'warning'
}
</script>

<style scoped>
.file-descriptions :deep(.el-descriptions__label) {
  white-space: nowrap;
}

.file-descriptions :deep(.el-descriptions__content) {
  overflow-wrap: anywhere;
  word-break: break-word;
}

.file-hash {
  word-break: break-all;
  font-family: monospace;
}
</style>
