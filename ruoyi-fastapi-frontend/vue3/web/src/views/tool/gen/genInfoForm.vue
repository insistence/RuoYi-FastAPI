<template>
  <el-form
    ref="genInfoForm"
    :model="info"
    :rules="rules"
    :validate-on-rule-change="false"
    label-width="150px"
  >
    <el-row>
      <el-col :span="12">
        <el-form-item prop="tplCategory">
          <template #label>{{ $t('tools:generationTemplate') }}</template>
          <el-select
            v-model="info.tplCategory"
            @change="tplSelectChange"
          >
            <el-option
              :label="$t('tools:singleTableCRUD')"
              value="crud"
            />
            <el-option
              :label="$t('tools:treeTableCRUD')"
              value="tree"
            />
            <el-option
              :label="$t('tools:masterDetailTablesCRUD')"
              value="sub"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="tplWebType">
          <template #label>{{ $t('tools:frontendType') }}</template>
          <el-select v-model="info.tplWebType">
            <el-option
              :label="$t('tools:vue2ElementUITemplate')"
              value="element-ui"
            />
            <el-option
              :label="$t('tools:vue3ElementPlusTemplate')"
              value="element-plus"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="packageName">
          <template #label>
            {{ $t('tools:packagePath')
            }}<el-tooltip
              :content="$t('tools:targetPythonModuleEGModuleAdminSystemWhereSystem')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-input v-model="info.packageName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="moduleName">
          <template #label>
            {{ $t('tools:moduleName')
            }}<el-tooltip
              :content="$t('tools:subsystemNameEGSystem')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-input v-model="info.moduleName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="businessName">
          <template #label>
            {{ $t('tools:featureName')
            }}<el-tooltip
              :content="$t('tools:englishFeatureNameEGUser')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-input v-model="info.businessName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="functionName">
          <template #label>
            {{ $t('tools:featureDescription')
            }}<el-tooltip
              :content="$t('tools:usedAsTheClassDescriptionEGUser')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-input v-model="info.functionName" />
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="formColNum">
          <template #label>
            {{ $t('tools:formLayout')
            }}<el-tooltip
              :content="$t('tools:chooseTheFormGridLayout')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-select v-model="info.formColNum">
            <el-option
              :label="$t('tools:oneColumn')"
              :value="1"
            />
            <el-option
              :label="$t('tools:twoColumns')"
              :value="2"
            />
            <el-option
              :label="$t('tools:threeColumns')"
              :value="3"
            />
          </el-select>
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="genView">
          <template #label>{{ $t('tools:extraFeatures') }}</template>
          <el-checkbox v-model="info.view">{{ $t('tools:generateDetailsPage') }}</el-checkbox>
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item prop="genType">
          <template #label>
            {{ $t('tools:codeOutput')
            }}<el-tooltip
              :content="$t('tools:downloadAZIPArchiveByDefaultOrChooseACustom')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-radio
            v-model="info.genType"
            value="0"
            >{{ $t('tools:zIPArchive') }}</el-radio
          >
          <el-radio
            v-model="info.genType"
            value="1"
            >{{ $t('tools:customPath') }}</el-radio
          >
        </el-form-item>
      </el-col>

      <el-col :span="12">
        <el-form-item>
          <template #label>
            {{ $t('system:parentMenu')
            }}<el-tooltip
              :content="$t('tools:placeUnderAMenuEGSystemManagement')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-tree-select
            v-model="info.parentMenuId"
            :data="menuOptions"
            :props="{ value: 'menuId', label: 'menuName', children: 'children' }"
            :placeholder="$t('tools:selectSystemMenu')"
            check-strictly
          />
        </el-form-item>
      </el-col>

      <el-col
        :span="24"
        v-if="info.genType == '1'"
      >
        <el-form-item prop="genPath">
          <template #label>
            {{ $t('tools:customPath')
            }}<el-tooltip
              :content="$t('tools:enterAnAbsolutePathIfEmptyFilesAreGeneratedIn')"
              placement="top"
            >
              <el-icon><question-filled /></el-icon>
            </el-tooltip>
          </template>
          <el-input v-model="info.genPath">
            <template #append>
              <el-dropdown>
                <el-button type="primary">
                  {{ $t('tools:chooseARecentPath')
                  }}<i class="el-icon-arrow-down el-icon--right"></i>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="info.genPath = '/'">{{
                      $t('tools:restoreTheDefaultOutputPath')
                    }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-input>
        </el-form-item>
      </el-col>
    </el-row>

    <template v-if="info.tplCategory == 'tree'">
      <h4 class="form-header">{{ $t('system:otherInformation') }}</h4>
      <el-row v-show="info.tplCategory == 'tree'">
        <el-col :span="12">
          <el-form-item>
            <template #label>
              {{ $t('tools:treeIDColumn')
              }}<el-tooltip
                :content="$t('tools:columnContainingTreeNodeIDsEGDeptId')"
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
            </template>
            <el-select
              v-model="info.treeCode"
              :placeholder="$t('system:select')"
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
            <template #label>
              {{ $t('tools:treeParentIDColumn')
              }}<el-tooltip
                :content="$t('tools:columnContainingParentNodeIDsEGParentId')"
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
            </template>
            <el-select
              v-model="info.treeParentCode"
              :placeholder="$t('system:select')"
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
            <template #label>
              {{ $t('tools:treeNameColumn')
              }}<el-tooltip
                :content="$t('tools:columnContainingNodeDisplayNamesEGDeptName')"
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
            </template>
            <el-select
              v-model="info.treeName"
              :placeholder="$t('system:select')"
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
    </template>

    <template v-if="info.tplCategory == 'sub'">
      <h4 class="form-header">{{ $t('tools:relationships') }}</h4>
      <el-row>
        <el-col :span="12">
          <el-form-item>
            <template #label>
              {{ $t('tools:relatedDetailTable')
              }}<el-tooltip
                :content="$t('tools:relatedDetailTableNameEGSysUser')"
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
            </template>
            <el-select
              v-model="info.subTableName"
              :placeholder="$t('system:select')"
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
            <template #label>
              {{ $t('tools:detailTableForeignKey')
              }}<el-tooltip
                :content="$t('tools:foreignKeyInTheDetailTableEGUserId')"
                placement="top"
              >
                <el-icon><question-filled /></el-icon>
              </el-tooltip>
            </template>
            <el-select
              v-model="info.subTableFkName"
              :placeholder="$t('system:select')"
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
    </template>
  </el-form>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import { useLocaleForm } from '@/composables/useLocaleForm'
import { listMenu } from '@/api/system/menu'

const subColumns = ref([])
const menuOptions = ref([])
const { proxy } = getCurrentInstance()
useLocaleForm(computed(() => proxy.$refs.genInfoForm))

const props = defineProps({
  info: {
    type: Object,
    default: null,
  },
  tables: {
    type: Array,
    default: null,
  },
})

// 表单校验
const rules = ref({
  tplCategory: [
    {
      required: true,
      get message() {
        return t('tools:selectGenerationTemplate')
      },
      trigger: 'blur',
    },
  ],
  packageName: [
    {
      required: true,
      get message() {
        return t('tools:enterPackagePath')
      },
      trigger: 'blur',
    },
  ],
  moduleName: [
    {
      required: true,
      get message() {
        return t('tools:enterModuleName')
      },
      trigger: 'blur',
    },
  ],
  businessName: [
    {
      required: true,
      get message() {
        return t('tools:enterFeatureName')
      },
      trigger: 'blur',
    },
  ],
  functionName: [
    {
      required: true,
      get message() {
        return t('tools:enterFeatureDescription')
      },
      trigger: 'blur',
    },
  ],
})

function subSelectChange(value) {
  props.info.subTableFkName = ''
}

function tplSelectChange(value) {
  if (value !== 'sub') {
    props.info.subTableName = ''
    props.info.subTableFkName = ''
  }
}

function setSubTableColumns(value) {
  for (var item in props.tables) {
    const name = props.tables[item].tableName
    if (value === name) {
      subColumns.value = props.tables[item].columns
      break
    }
  }
}

/** 查询菜单下拉树结构 */
function getMenuTreeselect() {
  listMenu().then((response) => {
    menuOptions.value = proxy.handleTree(response.data, 'menuId')
  })
}

onMounted(() => {
  getMenuTreeselect()
})

watch(
  () => props.info.subTableName,
  (val) => {
    setSubTableColumns(val)
  }
)

watch(
  () => props.info.tplWebType,
  (val) => {
    if (val === '') {
      props.info.tplWebType = 'element-plus'
    }
  }
)
</script>
