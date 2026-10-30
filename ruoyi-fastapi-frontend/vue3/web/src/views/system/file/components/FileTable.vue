<template>
  <el-table
    v-loading="loading"
    :data="fileList"
    @selection-change="emit('selection-change', $event)"
  >
    <el-table-column
      type="selection"
      width="50"
      align="center"
    />
    <el-table-column
      :label="$t('components:originalFileName')"
      align="left"
      prop="originalName"
      min-width="200"
      :show-overflow-tooltip="true"
    />
    <el-table-column
      :label="$t('components:accessType')"
      align="center"
      prop="accessType"
      width="110"
    >
      <template #default="scope">
        <el-tag
          v-if="scope.row.accessType === 'public'"
          type="success"
          >{{ $t('files:public') }}</el-tag
        >
        <el-tag
          v-else
          type="warning"
          >{{ $t('files:protected') }}</el-tag
        >
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('files:extension')"
      align="center"
      prop="extension"
      width="90"
    />
    <el-table-column
      :label="$t('tools:fileSize')"
      align="right"
      prop="fileSize"
      width="120"
    >
      <template #default="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
    </el-table-column>
    <el-table-column
      :label="$t('files:uploader')"
      align="center"
      prop="createBy"
      width="120"
      :show-overflow-tooltip="true"
    />
    <el-table-column
      :label="$t('components:owner')"
      align="center"
      prop="ownerName"
      width="120"
      :show-overflow-tooltip="true"
    >
      <template #default="scope">
        {{ scope.row.ownerName || scope.row.ownerUserId || '-' }}
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('system:department')"
      align="center"
      prop="deptName"
      width="140"
      :show-overflow-tooltip="true"
    >
      <template #default="scope">
        {{ scope.row.deptName || scope.row.deptId || '-' }}
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('files:fileExpiry')"
      align="center"
      prop="expireTime"
      width="150"
    >
      <template #default="scope">
        <el-tag
          :type="expirationTagType(scope.row.expireTime)"
          effect="plain"
        >
          {{ expirationLabel(scope.row.expireTime) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      label="ACL"
      align="center"
      width="130"
    >
      <template #default="scope">
        <el-tooltip
          v-if="scope.row.aclNearestExpireTime"
          :content="
            $t('files:nearestExpiryValue', { value0: parseTime(scope.row.aclNearestExpireTime) })
          "
          placement="top"
        >
          <el-tag
            :type="isAclExpiring(scope.row.aclNearestExpireTime) ? 'warning' : 'info'"
            effect="plain"
          >
            {{ scope.row.aclEntryCount }} {{ $t('authCenter:items')
            }}<span v-if="isAclExpiring(scope.row.aclNearestExpireTime)">
              {{ $t('files:expiringSoonLabel') }}</span
            >
          </el-tag>
        </el-tooltip>
        <span v-else>{{ scope.row.aclEntryCount || 0 }} {{ $t('authCenter:items') }}</span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('files:businessReferences')"
      align="center"
      prop="referenceCount"
      width="100"
    >
      <template #default="scope">
        <el-button
          v-if="scope.row.referenceCount"
          link
          type="primary"
          @click="emit('reference', scope.row)"
        >
          {{ scope.row.referenceCount }} {{ $t('authCenter:items') }}</el-button
        >
        <span v-else>{{ $t('files:0Items') }}</span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('files:storageStatus')"
      align="center"
      prop="storageStatus"
      width="110"
    >
      <template #default="scope">
        <el-tag
          :type="storageStatusTagType(scope.row.storageStatus)"
          effect="plain"
        >
          {{ storageStatusLabel(scope.row.storageStatus) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('files:uploadedAt')"
      align="center"
      prop="createTime"
      width="180"
    >
      <template #default="scope">{{ parseTime(scope.row.createTime) }}</template>
    </el-table-column>
    <el-table-column
      :label="$t('system:status')"
      align="center"
      prop="status"
      width="90"
    >
      <template #default="scope">
        <el-tag
          v-if="scope.row.status === 'active'"
          type="success"
          >{{ $t('layout:notices.active') }}</el-tag
        >
        <el-tag
          v-else-if="scope.row.status === 'deleted'"
          type="info"
        >
          {{ $t('files:deleted') }}</el-tag
        >
        <el-tag
          v-else
          type="warning"
          >{{ $t('files:deleting') }}</el-tag
        >
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('system:actions')"
      align="center"
      class-name="small-padding fixed-width"
      width="250"
      fixed="right"
    >
      <template #default="scope">
        <el-tooltip
          :content="$t('monitor:details')"
          placement="top"
        >
          <el-button
            link
            type="primary"
            icon="View"
            @click="emit('view', scope.row)"
            v-hasPermi="['system:file:query']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'active'"
          :content="$t('components:download')"
          placement="top"
        >
          <el-button
            link
            type="primary"
            icon="Download"
            @click="emit('download', scope.row)"
            v-hasPermi="['system:file:download']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.accessType === 'private' && scope.row.status === 'active'"
          :content="$t('files:permissions')"
          placement="top"
        >
          <el-button
            link
            type="primary"
            icon="Lock"
            @click="emit('acl', scope.row)"
            v-hasPermi="['system:file:edit']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'active'"
          :content="$t('files:transfer')"
          placement="top"
        >
          <el-button
            link
            type="primary"
            icon="Switch"
            @click="emit('transfer', scope.row)"
            v-hasPermi="['system:file:transfer']"
          />
        </el-tooltip>
        <el-tooltip
          :content="$t('files:audit')"
          placement="top"
        >
          <el-button
            link
            type="primary"
            icon="Tickets"
            @click="emit('audit', scope.row)"
            v-hasPermi="['system:file:query']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'active' && scope.row.referenceCount"
          :content="$t('files:cannotDeleteAReferencedFile')"
          placement="top"
        >
          <span class="file-action-disabled-wrapper">
            <el-button
              link
              type="danger"
              icon="Delete"
              disabled
              v-hasPermi="['system:file:remove']"
            />
          </span>
        </el-tooltip>
        <el-tooltip
          v-else-if="scope.row.status === 'active'"
          :content="$t('system:delete')"
          placement="top"
        >
          <el-button
            link
            type="danger"
            icon="Delete"
            @click="emit('delete', scope.row)"
            v-hasPermi="['system:file:remove']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'deleted'"
          :content="$t('components:restore')"
          placement="top"
        >
          <el-button
            link
            type="success"
            icon="RefreshLeft"
            @click="emit('restore', scope.row)"
            v-hasPermi="['system:file:restore']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status !== 'active'"
          :content="
            scope.row.status === 'purging'
              ? $t('files:retryPermanentDeletion')
              : $t('files:permanentlyDelete')
          "
          placement="top"
        >
          <el-button
            link
            type="danger"
            icon="DeleteFilled"
            @click="emit('purge', scope.row)"
            v-hasPermi="['system:file:purge']"
          />
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
import {
  expirationLabel,
  expirationTagType,
  formatFileSize,
  isAclExpiring,
  storageStatusLabel,
  storageStatusTagType,
} from './fileFormatters'

defineProps({
  fileList: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'selection-change',
  'view',
  'download',
  'reference',
  'acl',
  'transfer',
  'audit',
  'delete',
  'restore',
  'purge',
])
</script>

<style scoped>
.file-action-disabled-wrapper {
  display: inline-flex;
  align-items: center;
  margin-left: 12px;
  vertical-align: middle;
}
</style>
