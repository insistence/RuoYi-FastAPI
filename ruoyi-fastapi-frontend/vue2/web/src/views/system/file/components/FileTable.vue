<template>
  <el-table
    v-loading="loading"
    :data="fileList"
    @selection-change="$emit('selection-change', $event)"
  >
    <el-table-column
      type="selection"
      width="50"
      align="center"
    />
    <el-table-column
      :label="$t('file:originalName')"
      align="left"
      prop="originalName"
      min-width="200"
      :show-overflow-tooltip="true"
    />
    <el-table-column
      :label="$t('file:accessType')"
      align="center"
      prop="accessType"
      width="110"
    >
      <template slot-scope="scope">
        <el-tag
          v-if="scope.row.accessType === 'public'"
          type="success"
          >{{ $t('file:messages.public') }}</el-tag
        >
        <el-tag
          v-else
          type="warning"
          >{{ $t('file:messages.protected') }}</el-tag
        >
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('file:messages.extension')"
      align="center"
      prop="extension"
      width="90"
    />
    <el-table-column
      :label="$t('file:messages.fileSize')"
      align="right"
      prop="fileSize"
      width="120"
    >
      <template slot-scope="scope">{{ formatFileSize(scope.row.fileSize) }}</template>
    </el-table-column>
    <el-table-column
      :label="$t('file:messages.uploader')"
      align="center"
      prop="createBy"
      width="120"
      :show-overflow-tooltip="true"
    />
    <el-table-column
      :label="$t('file:owner')"
      align="center"
      prop="ownerName"
      width="120"
      :show-overflow-tooltip="true"
    >
      <template slot-scope="scope">
        {{ scope.row.ownerName || scope.row.ownerUserId || '-' }}
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('system:user.department')"
      align="center"
      prop="deptName"
      width="140"
      :show-overflow-tooltip="true"
    >
      <template slot-scope="scope">
        {{ scope.row.deptName || scope.row.deptId || '-' }}
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('file:messages.fileExpiry')"
      align="center"
      prop="expireTime"
      width="150"
    >
      <template slot-scope="scope">
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
      <template slot-scope="scope">
        <el-tooltip
          v-if="scope.row.aclNearestExpireTime"
          :content="
            $t('file:acl.nearestExpiry', { time: parseTime(scope.row.aclNearestExpireTime) })
          "
          placement="top"
        >
          <el-tag
            :type="isAclExpiring(scope.row.aclNearestExpireTime) ? 'warning' : 'info'"
            effect="plain"
          >
            {{ scope.row.aclEntryCount }} {{ $t('authCenter:messages.items') }}
            <span v-if="isAclExpiring(scope.row.aclNearestExpireTime)">{{
              $t('file:messages.expiringSoon')
            }}</span>
          </el-tag>
        </el-tooltip>
        <span v-else>{{ scope.row.aclEntryCount || 0 }} {{ $t('authCenter:messages.items') }}</span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('file:messages.businessReferences')"
      align="center"
      prop="referenceCount"
      width="100"
    >
      <template slot-scope="scope">
        <el-button
          v-if="scope.row.referenceCount"
          type="text"
          @click="$emit('reference', scope.row)"
          >{{ scope.row.referenceCount }} {{ $t('authCenter:messages.items') }}</el-button
        >
        <span v-else>{{ $t('file:messages.0Items') }}</span>
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('file:messages.storageStatus')"
      align="center"
      prop="storageStatus"
      width="110"
    >
      <template slot-scope="scope">
        <el-tag
          :type="storageStatusTagType(scope.row.storageStatus)"
          effect="plain"
          >{{ storageStatusLabel(scope.row.storageStatus) }}</el-tag
        >
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('file:messages.uploadedAt')"
      align="center"
      prop="createTime"
      width="180"
    >
      <template slot-scope="scope">{{ parseTime(scope.row.createTime) }}</template>
    </el-table-column>
    <el-table-column
      :label="$t('common:status')"
      align="center"
      prop="status"
      width="90"
    >
      <template slot-scope="scope">
        <el-tag
          v-if="scope.row.status === 'active'"
          type="success"
          >{{ $t('layout:notices.active') }}</el-tag
        >
        <el-tag
          v-else-if="scope.row.status === 'deleted'"
          type="info"
          >{{ $t('file:messages.deleted') }}</el-tag
        >
        <el-tag
          v-else
          type="warning"
          >{{ $t('file:messages.deleting') }}</el-tag
        >
      </template>
    </el-table-column>
    <el-table-column
      :label="$t('common:actions')"
      align="center"
      class-name="small-padding fixed-width"
      width="250"
      fixed="right"
    >
      <template slot-scope="scope">
        <el-tooltip
          :content="$t('common:detail')"
          placement="top"
        >
          <el-button
            type="text"
            icon="el-icon-view"
            @click="$emit('view', scope.row)"
            v-hasPermi="['system:file:query']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'active'"
          :content="$t('common:download')"
          placement="top"
        >
          <el-button
            type="text"
            icon="el-icon-download"
            @click="$emit('download', scope.row)"
            v-hasPermi="['system:file:download']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.accessType === 'private' && scope.row.status === 'active'"
          :content="$t('file:messages.permissions')"
          placement="top"
        >
          <el-button
            type="text"
            icon="el-icon-lock"
            @click="$emit('acl', scope.row)"
            v-hasPermi="['system:file:edit']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'active'"
          :content="$t('file:messages.transfer')"
          placement="top"
        >
          <el-button
            type="text"
            icon="el-icon-sort"
            @click="$emit('transfer', scope.row)"
            v-hasPermi="['system:file:transfer']"
          />
        </el-tooltip>
        <el-tooltip
          :content="$t('file:messages.audit')"
          placement="top"
        >
          <el-button
            type="text"
            icon="el-icon-tickets"
            @click="$emit('audit', scope.row)"
            v-hasPermi="['system:file:query']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'active' && scope.row.referenceCount"
          :content="$t('file:messages.cannotDeleteAReferencedFile')"
          placement="top"
        >
          <span class="file-action-disabled-wrapper">
            <el-button
              type="text"
              class="file-action-danger"
              icon="el-icon-delete"
              disabled
              v-hasPermi="['system:file:remove']"
            />
          </span>
        </el-tooltip>
        <el-tooltip
          v-else-if="scope.row.status === 'active'"
          :content="$t('common:delete')"
          placement="top"
        >
          <el-button
            type="text"
            class="file-action-danger"
            icon="el-icon-delete"
            @click="$emit('delete', scope.row)"
            v-hasPermi="['system:file:remove']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status === 'deleted'"
          :content="$t('common:restore')"
          placement="top"
        >
          <el-button
            type="text"
            class="file-action-success"
            icon="el-icon-refresh-left"
            @click="$emit('restore', scope.row)"
            v-hasPermi="['system:file:restore']"
          />
        </el-tooltip>
        <el-tooltip
          v-if="scope.row.status !== 'active'"
          :content="
            scope.row.status === 'purging'
              ? $t('file:expression.retryPermanentDeletion')
              : $t('file:messages.permanentlyDelete')
          "
          placement="top"
        >
          <el-button
            type="text"
            class="file-action-danger"
            icon="el-icon-delete-solid"
            @click="$emit('purge', scope.row)"
            v-hasPermi="['system:file:purge']"
          />
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
</template>

<script>
import {
  expirationLabel,
  expirationTagType,
  formatFileSize,
  isAclExpiring,
  storageStatusLabel,
  storageStatusTagType,
} from './fileFormatters'

export default {
  name: 'FileTable',
  props: {
    fileList: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    expirationLabel,
    expirationTagType,
    formatFileSize,
    isAclExpiring,
    storageStatusLabel,
    storageStatusTagType,
  },
}
</script>

<style scoped>
.file-action-disabled-wrapper {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  vertical-align: middle;
}

.file-action-danger {
  color: #f56c6c;
}

.file-action-success {
  color: #67c23a;
}
</style>
