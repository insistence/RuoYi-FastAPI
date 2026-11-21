<template>
  <el-form
    ref="basicInfoForm"
    :model="info"
    :rules="rules"
    label-width="150px"
  >
    <el-row>
      <el-col :span="12">
        <el-form-item
          :label="$t('tools:tableName')"
          prop="tableName"
        >
          <el-input
            :placeholder="$t('tools:enterRepositoryName')"
            v-model="info.tableName"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="$t('tools:tableDescription')"
          prop="tableComment"
        >
          <el-input
            :placeholder="$t('tools:enterAValue')"
            v-model="info.tableComment"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="$t('tools:entityClassName')"
          prop="className"
        >
          <el-input
            :placeholder="$t('tools:enterAValue')"
            v-model="info.className"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="$t('tools:author')"
          prop="functionAuthor"
        >
          <el-input
            :placeholder="$t('tools:enterAValue')"
            v-model="info.functionAuthor"
          />
        </el-form-item>
      </el-col>
      <el-col :span="24">
        <el-form-item
          :label="$t('system:remarks')"
          prop="remark"
        >
          <el-input
            type="textarea"
            :rows="3"
            v-model="info.remark"
          ></el-input>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script setup>
import { t } from '@/i18n/adapter'
defineProps({
  info: {
    type: Object,
    default: null,
  },
})

// 表单校验
const rules = ref({
  tableName: [
    {
      required: true,
      get message() {
        return t('tools:enterTableName')
      },
      trigger: 'blur',
    },
  ],
  tableComment: [
    {
      required: true,
      get message() {
        return t('tools:enterTableDescription')
      },
      trigger: 'blur',
    },
  ],
  className: [
    {
      required: true,
      get message() {
        return t('tools:enterEntityClassName')
      },
      trigger: 'blur',
    },
  ],
  functionAuthor: [
    {
      required: true,
      get message() {
        return t('tools:enterAuthor')
      },
      trigger: 'blur',
    },
  ],
})
</script>
