<template>
  <el-drawer
    :title="$t('file:dialog.references', { name: fileName })"
    :visible.sync="visible"
    size="55%"
    append-to-body
  >
    <div class="drawer-content">
      <el-alert
        :title="
          $t('file:messages.referencedFilesCannotBeMovedToTheRecycleBinRemoveTheirReferences')
        "
        type="warning"
        :closable="false"
        show-icon
        class="mb8"
      />
      <el-table
        v-loading="loading"
        :data="referenceList"
      >
        <el-table-column
          :label="$t('monitor:log.businessType')"
          align="center"
          prop="businessType"
          width="130"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          :label="$t('file:messages.businessName')"
          align="left"
          prop="businessName"
          min-width="180"
          :show-overflow-tooltip="true"
        >
          <template slot-scope="scope">{{ scope.row.businessName || '-' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.businessID')"
          align="center"
          prop="businessId"
          min-width="160"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          :label="$t('file:messages.retentionExpires')"
          align="center"
          prop="retentionExpireTime"
          width="180"
        >
          <template slot-scope="scope">
            {{
              scope.row.retentionExpireTime
                ? parseTime(scope.row.retentionExpireTime)
                : $t('file:expression.retainIndefinitely')
            }}
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('common:source')"
          align="center"
          width="100"
        >
          <template slot-scope="scope">
            <el-tag
              v-if="scope.row.legacy"
              type="info"
              effect="plain"
            >
              {{ $t('file:messages.legacyField') }}
            </el-tag>
            <el-tag
              v-else
              type="success"
              effect="plain"
              >{{ $t('file:messages.references') }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.registeredBy')"
          align="center"
          prop="createBy"
          width="110"
          :show-overflow-tooltip="true"
        >
          <template slot-scope="scope">{{ scope.row.createBy || '-' }}</template>
        </el-table-column>
        <el-table-column
          :label="$t('file:messages.registeredAt')"
          align="center"
          prop="createTime"
          width="180"
        >
          <template slot-scope="scope">
            {{ parseTime(scope.row.createTime) || '-' }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-drawer>
</template>

<script>
import { listFileReference } from '@/api/system/file'

export default {
  name: 'FileReferenceDrawer',
  data() {
    return {
      visible: false,
      loading: false,
      fileName: '',
      referenceList: [],
    }
  },
  methods: {
    open(row) {
      this.fileName = row.originalName
      this.visible = true
      this.loading = true
      listFileReference(row.fileId)
        .then((response) => {
          this.referenceList = response.data
        })
        .finally(() => {
          this.loading = false
        })
    },
  },
}
</script>

<style scoped>
.drawer-content {
  padding: 0 20px 20px;
}
</style>
