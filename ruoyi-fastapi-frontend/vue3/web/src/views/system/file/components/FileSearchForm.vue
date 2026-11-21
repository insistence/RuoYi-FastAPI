<template>
  <el-form
    ref="queryRef"
    v-show="show"
    :model="queryParams"
    :inline="true"
    label-width="68px"
  >
    <el-form-item
      :label="$t('components:fileName')"
      prop="originalName"
    >
      <el-input
        v-model="queryParams.originalName"
        :placeholder="$t('files:enterTheOriginalFileName')"
        clearable
        style="width: 200px"
        @keyup.enter="emit('query')"
      />
    </el-form-item>
    <el-form-item
      :label="$t('components:accessType')"
      prop="accessType"
    >
      <el-select
        v-model="queryParams.accessType"
        :placeholder="$t('files:selectAnAccessType')"
        clearable
        style="width: 200px"
      >
        <el-option
          :label="$t('files:publicFiles')"
          value="public"
        />
        <el-option
          :label="$t('files:protectedFiles')"
          value="private"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      :label="$t('files:fileStatus')"
      prop="status"
    >
      <el-select
        v-model="queryParams.status"
        :placeholder="$t('files:selectAFileStatus')"
        clearable
        style="width: 200px"
      >
        <el-option
          :label="$t('layout:notices.active')"
          value="active"
        />
        <el-option
          :label="$t('files:deleted')"
          value="deleted"
        />
        <el-option
          :label="$t('files:deleting')"
          value="purging"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      :label="$t('files:uploader')"
      prop="createBy"
    >
      <el-input
        v-model="queryParams.createBy"
        :placeholder="$t('files:enterAnUploader')"
        clearable
        style="width: 200px"
        @keyup.enter="emit('query')"
      />
    </el-form-item>
    <el-form-item
      :label="$t('components:owner')"
      prop="ownerName"
    >
      <el-input
        v-model="queryParams.ownerName"
        :placeholder="$t('files:enterAnOwner')"
        clearable
        style="width: 200px"
        @keyup.enter="emit('query')"
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:department')"
      prop="deptId"
    >
      <el-tree-select
        v-model="queryParams.deptId"
        :data="deptOptions"
        :props="{ value: 'id', label: 'label', children: 'children' }"
        value-key="id"
        :placeholder="$t('files:selectADepartmentLabel')"
        filterable
        clearable
        check-strictly
        :render-after-expand="false"
        style="width: 200px"
      />
    </el-form-item>
    <el-form-item
      :label="$t('files:expiryStatus')"
      prop="expirationStatus"
    >
      <el-select
        v-model="queryParams.expirationStatus"
        :placeholder="$t('files:selectAnExpiryStatus')"
        clearable
        style="width: 200px"
      >
        <el-option
          :label="$t('files:noExpiry')"
          value="permanent"
        />
        <el-option
          :label="$t('files:valid')"
          value="valid"
        />
        <el-option
          :label="$t('files:expiresWithin7Days')"
          value="expiring"
        />
        <el-option
          :label="$t('components:expired')"
          value="expired"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="$t('files:uploadedAt')">
      <el-date-picker
        v-model="dateRange"
        value-format="YYYY-MM-DD HH:mm:ss"
        type="datetimerange"
        style="width: 200px"
        range-separator="-"
        :start-placeholder="$t('monitor:startTime')"
        :end-placeholder="$t('monitor:endTime')"
      />
    </el-form-item>
    <el-form-item>
      <el-button
        type="primary"
        icon="Search"
        @click="emit('query')"
        >{{ $t('system:search') }}</el-button
      >
      <el-button
        icon="Refresh"
        @click="handleReset"
        >{{ $t('system:reset') }}</el-button
      >
    </el-form-item>
  </el-form>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: true,
  },
  deptOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['query', 'reset'])
const queryParams = defineModel('queryParams', {
  type: Object,
  required: true,
})
const dateRange = defineModel('dateRange', {
  type: Array,
  default: () => [],
})
const queryRef = ref()

function handleReset() {
  dateRange.value = []
  queryRef.value?.resetFields()
  emit('reset')
}
</script>
