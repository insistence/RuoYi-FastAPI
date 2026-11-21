<template>
  <el-form
    :validate-on-rule-change="false"
    ref="genInfoForm"
    :model="info"
    :rules="rules"
    label-width="150px"
  >
    <el-row>
      <el-col :span="12">
        <el-form-item prop="tplCategory">
          <span slot="label">{{ $t('tool:messages.generationTemplate') }}</span>
          <el-select
            v-model="info.tplCategory"
            @change="tplSelectChange"
          >
            <el-option
              :label="$t('tool:messages.singleTableCRUD')"
              value="crud"
            />
            <el-option
              :label="$t('tool:messages.treeTableCRUD')"
              value="tree"
            />
            <el-option
              :label="$t('tool:messages.masterDetailTablesCRUD')"
              value="sub"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item prop="tplWebType">
          <span slot="label">{{ $t('tool:messages.frontendType') }}</span>
          <el-select v-model="info.tplWebType">
            <el-option
              :label="$t('tool:messages.vue2ElementUITemplate')"
              value="element-ui"
            />
            <el-option
              :label="$t('tool:messages.vue3ElementPlusTemplate')"
              value="element-plus"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item prop="packageName">
          <span slot="label">
            {{ $t('tool:messages.packagePath') }}
            <el-tooltip
              :content="$t('tool:messages.targetPythonModuleEGModuleAdminSystemWhereSystemIsThe')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-input v-model="info.packageName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="moduleName">
          <span slot="label">
            {{ $t('tool:messages.moduleName') }}
            <el-tooltip
              :content="$t('tool:messages.subsystemNameEGSystem')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-input v-model="info.moduleName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="businessName">
          <span slot="label">
            {{ $t('tool:messages.featureName') }}
            <el-tooltip
              :content="$t('tool:messages.englishFeatureNameEGUser')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-input v-model="info.businessName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="functionName">
          <span slot="label">
            {{ $t('tool:messages.featureDescription') }}
            <el-tooltip
              :content="$t('tool:messages.usedAsTheClassDescriptionEGUser')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-input v-model="info.functionName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="formColNum">
          <span slot="label">
            {{ $t('tool:messages.formLayout') }}
            <el-tooltip
              :content="$t('tool:messages.chooseTheFormGridLayout')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-select v-model="info.formColNum">
            <el-option
              :label="$t('tool:messages.oneColumn')"
              :value="1"
            />
            <el-option
              :label="$t('tool:messages.twoColumns')"
              :value="2"
            />
            <el-option
              :label="$t('tool:messages.threeColumns')"
              :value="3"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="genView">
          <span slot="label">{{ $t('tool:messages.extraFeatures') }}</span>
          <el-checkbox v-model="info.view">{{
            $t('tool:messages.generateDetailsPage')
          }}</el-checkbox>
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="genType">
          <span slot="label">
            {{ $t('tool:messages.codeOutput') }}
            <el-tooltip
              :content="$t('tool:messages.downloadAZIPArchiveByDefaultOrChooseACustomOutputPath')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-radio
            v-model="info.genType"
            label="0"
            >{{ $t('tool:messages.zIPArchive') }}</el-radio
          >
          <el-radio
            v-model="info.genType"
            label="1"
            >{{ $t('tool:messages.customPath') }}</el-radio
          >
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item>
          <span slot="label">
            {{ $t('system:menu.parent') }}
            <el-tooltip
              :content="$t('tool:messages.placeUnderAMenuEGSystemManagement')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <treeselect
            :append-to-body="true"
            v-model="info.parentMenuId"
            :options="menus"
            :normalizer="normalizer"
            :show-count="true"
            :placeholder="$t('tool:messages.selectSystemMenu')"
          />
        </el-form-item>
      </el-col>

      <el-col
        :span="24"
        v-if="info.genType == '1'"
      >
        <el-form-item prop="genPath">
          <span slot="label">
            {{ $t('tool:messages.customPath') }}
            <el-tooltip
              :content="$t('tool:messages.enterAnAbsolutePathIfEmptyFilesAreGeneratedInTheCurrent')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-input v-model="info.genPath">
            <el-dropdown slot="append">
              <el-button type="primary">
                {{ $t('tool:messages.chooseARecentPath') }}
                <i class="el-icon-arrow-down el-icon--right"></i>
              </el-button>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item @click.native="info.genPath = '/'">{{
                  $t('tool:messages.restoreTheDefaultOutputPath')
                }}</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
          </el-input>
        </el-form-item>
      </el-col>
    </el-row>

    <el-row v-show="info.tplCategory == 'tree'">
      <h4 class="form-header">{{ $t('system:otherInformation') }}</h4>
      <el-col :span="12">
        <el-form-item>
          <span slot="label">
            {{ $t('tool:messages.treeIDColumn') }}
            <el-tooltip
              :content="$t('tool:messages.columnContainingTreeNodeIDsEGDeptId')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-select
            v-model="info.treeCode"
            :placeholder="$t('common:selectPlaceholder')"
          >
            <el-option
              v-for="(column, index) in info.columns"
              :key="index"
              :label="column.columnName + '：' + column.columnComment"
              :value="column.columnName"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item>
          <span slot="label">
            {{ $t('tool:messages.treeParentIDColumn') }}
            <el-tooltip
              :content="$t('tool:messages.columnContainingParentNodeIDsEGParentId')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-select
            v-model="info.treeParentCode"
            :placeholder="$t('common:selectPlaceholder')"
          >
            <el-option
              v-for="(column, index) in info.columns"
              :key="index"
              :label="column.columnName + '：' + column.columnComment"
              :value="column.columnName"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item>
          <span slot="label">
            {{ $t('tool:messages.treeNameColumn') }}
            <el-tooltip
              :content="$t('tool:messages.columnContainingNodeDisplayNamesEGDeptName')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-select
            v-model="info.treeName"
            :placeholder="$t('common:selectPlaceholder')"
          >
            <el-option
              v-for="(column, index) in info.columns"
              :key="index"
              :label="column.columnName + '：' + column.columnComment"
              :value="column.columnName"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>
    <el-row v-show="info.tplCategory == 'sub'">
      <h4 class="form-header">{{ $t('tool:messages.relationships') }}</h4>
      <el-col :span="12">
        <el-form-item>
          <span slot="label">
            {{ $t('tool:messages.relatedDetailTable') }}
            <el-tooltip
              :content="$t('tool:messages.relatedDetailTableNameEGSysUser')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-select
            v-model="info.subTableName"
            :placeholder="$t('common:selectPlaceholder')"
            @change="subSelectChange"
          >
            <el-option
              v-for="(table, index) in tables"
              :key="index"
              :label="table.tableName + '：' + table.tableComment"
              :value="table.tableName"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item>
          <span slot="label">
            {{ $t('tool:messages.detailTableForeignKey') }}
            <el-tooltip
              :content="$t('tool:messages.foreignKeyInTheDetailTableEGUserId')"
              placement="top"
            >
              <i class="el-icon-question"></i>
            </el-tooltip>
          </span>
          <el-select
            v-model="info.subTableFkName"
            :placeholder="$t('common:selectPlaceholder')"
          >
            <el-option
              v-for="(column, index) in subColumns"
              :key="index"
              :label="column.columnName + '：' + column.columnComment"
              :value="column.columnName"
            ></el-option>
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>

<script>
import { t } from '@/i18n/adapter'

import Treeselect from '@riophae/vue-treeselect'
import '@riophae/vue-treeselect/dist/vue-treeselect.css'

export default {
  components: { Treeselect },
  props: {
    info: {
      type: Object,
      default: null,
    },
    tables: {
      type: Array,
      default: null,
    },
    menus: {
      type: Array,
      default: [],
    },
  },
  data() {
    return {
      subColumns: [],
      rules: {
        tplCategory: [
          {
            required: true,
            message: () => t('tool:messages.selectGenerationTemplate'),
            trigger: 'blur',
          },
        ],
        packageName: [
          { required: true, message: () => t('tool:messages.enterPackagePath'), trigger: 'blur' },
        ],
        moduleName: [
          { required: true, message: () => t('tool:messages.enterModuleName'), trigger: 'blur' },
        ],
        businessName: [
          { required: true, message: () => t('tool:messages.enterFeatureName'), trigger: 'blur' },
        ],
        functionName: [
          {
            required: true,
            message: () => t('tool:messages.enterFeatureDescription'),
            trigger: 'blur',
          },
        ],
      },
    }
  },
  watch: {
    'info.subTableName': function (val) {
      this.setSubTableColumns(val)
    },
    'info.tplWebType': function (val) {
      if (val === '') {
        this.info.tplWebType = 'element-ui'
      }
    },
  },
  methods: {
    /** 转换菜单数据结构 */
    normalizer(node) {
      if (node.children && !node.children.length) {
        delete node.children
      }
      return {
        id: node.menuId,
        label: node.menuName,
        children: node.children,
      }
    },
    /** 选择子表名触发 */
    subSelectChange(value) {
      this.info.subTableFkName = ''
    },
    /** 选择生成模板触发 */
    tplSelectChange(value) {
      if (value !== 'sub') {
        this.info.subTableName = ''
        this.info.subTableFkName = ''
      }
    },
    /** 设置关联外键 */
    setSubTableColumns(value) {
      for (var item in this.tables) {
        const name = this.tables[item].tableName
        if (value === name) {
          this.subColumns = this.tables[item].columns
          break
        }
      }
    },
  },
}
</script>
