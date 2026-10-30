<template>
  <el-form
    :validate-on-rule-change="false"
    ref="queryForm"
    v-show="show"
    :model="queryParams"
    size="small"
    :inline="true"
    label-width="68px"
  >
    <el-form-item
      :label="$t('file:name')"
      prop="originalName"
    >
      <el-input
        v-model="queryParams.originalName"
        :placeholder="$t('file:messages.enterTheOriginalFileName')"
        clearable
        style="width: 200px"
        @keyup.enter.native="$emit('query')"
      />
    </el-form-item>
    <el-form-item
      :label="$t('file:accessType')"
      prop="accessType"
    >
      <el-select
        v-model="queryParams.accessType"
        :placeholder="$t('file:messages.selectAnAccessType')"
        clearable
        style="width: 200px"
      >
        <el-option
          :label="$t('file:messages.publicFiles')"
          value="public"
        />
        <el-option
          :label="$t('file:messages.protectedFiles')"
          value="private"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      :label="$t('file:messages.fileStatus')"
      prop="status"
    >
      <el-select
        v-model="queryParams.status"
        :placeholder="$t('file:messages.selectAFileStatus')"
        clearable
        style="width: 200px"
      >
        <el-option
          :label="$t('layout:notices.active')"
          value="active"
        />
        <el-option
          :label="$t('file:messages.deleted')"
          value="deleted"
        />
        <el-option
          :label="$t('file:messages.deleting')"
          value="purging"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      :label="$t('file:messages.uploader')"
      prop="createBy"
    >
      <el-input
        v-model="queryParams.createBy"
        :placeholder="$t('file:messages.enterAnUploader')"
        clearable
        style="width: 200px"
        @keyup.enter.native="$emit('query')"
      />
    </el-form-item>
    <el-form-item
      :label="$t('file:owner')"
      prop="ownerName"
    >
      <el-input
        v-model="queryParams.ownerName"
        :placeholder="$t('file:messages.enterAnOwner')"
        clearable
        style="width: 200px"
        @keyup.enter.native="$emit('query')"
      />
    </el-form-item>
    <el-form-item
      :label="$t('system:user.department')"
      prop="deptId"
    >
      <treeselect
        v-model="queryParams.deptId"
        :options="deptOptions"
        :placeholder="$t('file:messages.selectADepartment')"
        :normalizer="normalizer"
        :clearable="true"
        :searchable="true"
        style="width: 200px"
      />
    </el-form-item>
    <el-form-item
      :label="$t('file:messages.expiryStatus')"
      prop="expirationStatus"
    >
      <el-select
        v-model="queryParams.expirationStatus"
        :placeholder="$t('file:messages.selectAnExpiryStatus')"
        clearable
        style="width: 200px"
      >
        <el-option
          :label="$t('file:messages.noExpiry')"
          value="permanent"
        />
        <el-option
          :label="$t('file:messages.valid')"
          value="valid"
        />
        <el-option
          :label="$t('file:messages.expiresWithin7Days')"
          value="expiring"
        />
        <el-option
          :label="$t('common:expired')"
          value="expired"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="$t('file:messages.uploadedAt')">
      <el-date-picker
        :value="dateRange"
        value-format="yyyy-MM-dd HH:mm:ss"
        type="datetimerange"
        style="width: 200px"
        range-separator="-"
        :start-placeholder="$t('common:startTime')"
        :end-placeholder="$t('common:endTime')"
        @input="$emit('update:dateRange', $event)"
      />
    </el-form-item>
    <el-form-item>
      <el-button
        type="primary"
        icon="el-icon-search"
        size="mini"
        @click="$emit('query')"
        >{{ $t('common:search') }}</el-button
      >
      <el-button
        icon="el-icon-refresh"
        size="mini"
        @click="handleReset"
        >{{ $t('common:reset') }}</el-button
      >
    </el-form-item>
  </el-form>
</template>

<script>
import Treeselect from '@riophae/vue-treeselect'
import '@riophae/vue-treeselect/dist/vue-treeselect.css'

export default {
  name: 'FileSearchForm',
  components: { Treeselect },
  props: {
    show: {
      type: Boolean,
      default: true,
    },
    queryParams: {
      type: Object,
      required: true,
    },
    dateRange: {
      type: Array,
      default: () => [],
    },
    deptOptions: {
      type: Array,
      default: () => [],
    },
  },
  methods: {
    normalizer(node) {
      return {
        id: node.id,
        label: node.label,
        children: node.children,
      }
    },
    handleReset() {
      this.$emit('update:dateRange', [])
      this.$refs.queryForm.resetFields()
      this.$emit('reset')
    },
  },
}
</script>
