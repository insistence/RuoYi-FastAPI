<template>
  <el-dialog
    :title="$t('file:messages.fileDetails')"
    :visible.sync="dialogOpen"
    width="820px"
    append-to-body
  >
    <el-descriptions
      :column="2"
      border
    >
      <el-descriptions-item
        :label="$t('file:messages.fileID')"
        :span="2"
      >
        {{ detail.fileId }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:originalName')">
        {{ detail.originalName }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.storedFileName')">
        {{ detail.storedName }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:accessType')">
        {{ accessTypeLabel(detail.accessType) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.fileStatus')">
        {{ statusLabel(detail.status) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.uploader')">
        {{ detail.createBy || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.uploaderID')">
        {{ detail.uploadUserId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.uploaderPermissions')">
        <el-tag
          v-if="detail.accessType === 'private' && detail.uploadUserId"
          :type="uploaderPermissionTagType(detail)"
          effect="plain"
          >{{ uploaderPermissionLabel(detail) }}</el-tag
        >
        <span v-else>{{ uploaderPermissionLabel(detail) }}</span>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:owner')">
        {{ detail.ownerName || detail.ownerUserId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('system:user.department')">
        {{ detail.deptName || detail.deptId || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.storageStatus')">
        {{ storageStatusLabel(detail.storageStatus) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.aCLEntries')">
        {{ detail.aclEntryCount || 0 }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.businessReferences')">
        <el-button
          v-if="detail.referenceCount"
          type="text"
          @click="$emit('reference', detail)"
          >{{ detail.referenceCount }} {{ $t('authCenter:messages.items') }}</el-button
        >
        <span v-else>{{ $t('file:messages.0Items') }}</span>
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.permissionsVersion')">
        {{
          detail.aclVersion !== undefined && detail.aclVersion !== null ? detail.aclVersion : '-'
        }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.fileSize')">
        {{ formatFileSize(detail.fileSize) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.contentType')">
        {{ detail.contentType || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.extension')">
        {{ detail.extension || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.uploadedAt')">
        {{ parseTime(detail.createTime) }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.expiresAt')">
        {{ parseTime(detail.expireTime) || '-' }}
      </el-descriptions-item>
      <el-descriptions-item :label="$t('file:messages.moveToRecycleBin')">
        {{ parseTime(detail.deletedTime) || '-' }}
      </el-descriptions-item>
      <el-descriptions-item
        :label="$t('file:messages.relativeStoragePath')"
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
    <div
      slot="footer"
      class="dialog-footer"
    >
      <el-button @click="dialogOpen = false">{{ $t('common:close') }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { t } from '@/i18n/adapter'

import { accessTypeLabel, formatFileSize, statusLabel, storageStatusLabel } from './fileFormatters'

export default {
  name: 'FileDetailDialog',
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    detail: {
      type: Object,
      default: () => ({}),
    },
  },
  computed: {
    dialogOpen: {
      get() {
        return this.open
      },
      set(value) {
        this.$emit('update:open', value)
      },
    },
  },
  methods: {
    accessTypeLabel,
    formatFileSize,
    statusLabel,
    storageStatusLabel,
    uploaderPermissionLabel(file) {
      if (file.accessType !== 'private') {
        return t('file:messages.publicFilesDoNotRequireIndividualPermissions')
      }
      if (!file.uploadUserId) {
        return t('file:messages.uploaderNotRecorded')
      }
      const accessEnabled =
        file.uploaderAccessEnabled === '1' || file.uploaderAccessEnabled === true
      if (file.uploadUserId === file.ownerUserId) {
        return accessEnabled
          ? t('file:messages.legacyAccessRetainedAlsoTheOwner')
          : t('file:messages.legacyAccessRemovedAccessRemainsThroughOwnership')
      }
      return accessEnabled
        ? t('file:messages.retainedAnExplicitDenyTakesPrecedence')
        : t('file:messages.removedUploadingTheFileNoLongerGrantsAccess')
    },
    uploaderPermissionTagType(file) {
      if (file.uploaderAccessEnabled !== '1' && file.uploaderAccessEnabled !== true) {
        return 'info'
      }
      return file.uploadUserId === file.ownerUserId ? 'primary' : 'warning'
    },
  },
}
</script>

<style scoped>
.file-hash {
  word-break: break-all;
  font-family: monospace;
}
</style>
