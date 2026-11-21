<template>
  <el-form
    :validate-on-rule-change="false"
    ref="basicInfoForm"
    :model="info"
    :rules="rules"
    label-width="150px"
  >
    <el-row>
      <el-col :span="12">
        <el-form-item
          :label="$t('tool:gen.tableName')"
          prop="tableName"
        >
          <el-input
            :placeholder="$t('tool:messages.enterRepositoryName')"
            v-model="info.tableName"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="$t('tool:gen.tableComment')"
          prop="tableComment"
        >
          <el-input
            :placeholder="$t('tool:messages.enterAValue')"
            v-model="info.tableComment"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="$t('tool:messages.entityClassName')"
          prop="className"
        >
          <el-input
            :placeholder="$t('tool:messages.enterAValue')"
            v-model="info.className"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item
          :label="$t('pluginAdmin:messages.author')"
          prop="functionAuthor"
        >
          <el-input
            :placeholder="$t('tool:messages.enterAValue')"
            v-model="info.functionAuthor"
          />
        </el-form-item>
      </el-col>
      <el-col :span="24">
        <el-form-item
          :label="$t('common:remark')"
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

<script>
import { t } from '@/i18n/adapter'

export default {
  props: {
    info: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      rules: {
        tableName: [
          { required: true, message: () => t('tool:messages.enterTableName'), trigger: 'blur' },
        ],
        tableComment: [
          {
            required: true,
            message: () => t('tool:messages.enterTableDescription'),
            trigger: 'blur',
          },
        ],
        className: [
          {
            required: true,
            message: () => t('tool:messages.enterEntityClassName'),
            trigger: 'blur',
          },
        ],
        functionAuthor: [
          { required: true, message: () => t('tool:messages.enterAuthor'), trigger: 'blur' },
        ],
      },
    }
  },
}
</script>
