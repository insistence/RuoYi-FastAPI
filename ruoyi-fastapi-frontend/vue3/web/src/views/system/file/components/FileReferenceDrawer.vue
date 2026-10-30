<template>
  <el-drawer
    :title="$t('files:businessReferencesValue', { fileName: fileName })"
    v-model="visible"
    size="55%"
    append-to-body
  >
    <el-alert
      :title="$t('files:referencedFilesCannotBeMovedToTheRecycleBinRemove')"
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
        :label="$t('monitor:businessType')"
        align="center"
        prop="businessType"
        width="130"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('files:businessName')"
        align="left"
        prop="businessName"
        min-width="180"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">{{ scope.row.businessName || '-' }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('files:businessID')"
        align="center"
        prop="businessId"
        min-width="160"
        :show-overflow-tooltip="true"
      />
      <el-table-column
        :label="$t('files:retentionExpires')"
        align="center"
        prop="retentionExpireTime"
        width="180"
      >
        <template #default="scope">
          {{
            scope.row.retentionExpireTime
              ? parseTime(scope.row.retentionExpireTime)
              : $t('files:keepPermanently')
          }}
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('monitor:source')"
        align="center"
        width="100"
      >
        <template #default="scope">
          <el-tag
            v-if="scope.row.legacy"
            type="info"
            effect="plain"
          >
            {{ $t('files:legacyField') }}</el-tag
          >
          <el-tag
            v-else
            type="success"
            effect="plain"
            >{{ $t('files:references') }}</el-tag
          >
        </template>
      </el-table-column>
      <el-table-column
        :label="$t('files:registeredBy')"
        align="center"
        prop="createBy"
        width="110"
        :show-overflow-tooltip="true"
      >
        <template #default="scope">{{ scope.row.createBy || '-' }}</template>
      </el-table-column>
      <el-table-column
        :label="$t('files:registeredAt')"
        align="center"
        prop="createTime"
        width="180"
      >
        <template #default="scope">
          {{ parseTime(scope.row.createTime) || '-' }}
        </template>
      </el-table-column>
    </el-table>
  </el-drawer>
</template>

<script setup>
import { listFileReference } from '@/api/system/file'

const visible = ref(false)
const loading = ref(false)
const fileName = ref('')
const referenceList = ref([])

function open(row) {
  fileName.value = row.originalName
  visible.value = true
  loading.value = true
  listFileReference(row.fileId)
    .then((response) => {
      referenceList.value = response.data
    })
    .finally(() => {
      loading.value = false
    })
}

defineExpose({ open })
</script>
