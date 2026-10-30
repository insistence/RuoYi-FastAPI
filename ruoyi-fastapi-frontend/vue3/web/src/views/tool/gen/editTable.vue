<template>
  <el-card>
    <el-tabs v-model="activeName">
      <el-tab-pane
        :label="$t('system:basicInformation')"
        name="basic"
      >
        <basic-info-form
          ref="basicInfo"
          :info="info"
        />
      </el-tab-pane>
      <el-tab-pane
        :label="$t('tools:columnInformation')"
        name="columnInfo"
      >
        <el-table
          ref="dragTable"
          :data="columns"
          row-key="columnId"
          :max-height="tableHeight"
        >
          <el-table-column
            :label="$t('system:noLabel')"
            type="index"
            min-width="5%"
            class-name="allowDrag"
          />
          <el-table-column
            :label="$t('tools:columnName')"
            prop="columnName"
            min-width="10%"
            :show-overflow-tooltip="true"
            class-name="allowDrag"
          />
          <el-table-column
            :label="$t('tools:columnDescription')"
            min-width="10%"
          >
            <template #default="scope">
              <el-input v-model="scope.row.columnComment"></el-input>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:databaseType')"
            prop="columnType"
            min-width="10%"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('tools:pythonType')"
            min-width="11%"
          >
            <template #default="scope">
              <el-select v-model="scope.row.pythonType">
                <el-option
                  label="str"
                  value="str"
                />
                <el-option
                  label="int"
                  value="int"
                />
                <el-option
                  label="float"
                  value="float"
                />
                <el-option
                  label="Decimal"
                  value="Decimal"
                />
                <el-option
                  label="date"
                  value="date"
                />
                <el-option
                  label="time"
                  value="time"
                />
                <el-option
                  label="datetime"
                  value="datetime"
                />
                <el-option
                  label="bytes"
                  value="bytes"
                />
                <el-option
                  label="dict"
                  value="dict"
                />
                <el-option
                  label="list"
                  value="list"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:pythonAttribute')"
            min-width="10%"
          >
            <template #default="scope">
              <el-input v-model="scope.row.pythonField"></el-input>
            </template>
          </el-table-column>

          <el-table-column
            :label="$t('tools:insert')"
            min-width="5%"
          >
            <template #default="scope">
              <el-checkbox
                true-value="1"
                false-value="0"
                v-model="scope.row.isInsert"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('oauth:edit')"
            min-width="5%"
          >
            <template #default="scope">
              <el-checkbox
                true-value="1"
                false-value="0"
                v-model="scope.row.isEdit"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:list')"
            min-width="5%"
          >
            <template #default="scope">
              <el-checkbox
                true-value="1"
                false-value="0"
                v-model="scope.row.isList"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:search')"
            min-width="5%"
          >
            <template #default="scope">
              <el-checkbox
                true-value="1"
                false-value="0"
                v-model="scope.row.isQuery"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:queryMethod')"
            min-width="10%"
          >
            <template #default="scope">
              <el-select v-model="scope.row.queryType">
                <el-option
                  label="="
                  value="EQ"
                />
                <el-option
                  label="!="
                  value="NE"
                />
                <el-option
                  label=">"
                  value="GT"
                />
                <el-option
                  label=">="
                  value="GTE"
                />
                <el-option
                  label="<"
                  value="LT"
                />
                <el-option
                  label="<="
                  value="LTE"
                />
                <el-option
                  label="LIKE"
                  value="LIKE"
                />
                <el-option
                  label="BETWEEN"
                  value="BETWEEN"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:required')"
            min-width="5%"
          >
            <template #default="scope">
              <el-checkbox
                true-value="1"
                false-value="0"
                v-model="scope.row.isRequired"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:unique')"
            min-width="5%"
          >
            <template #default="scope">
              <el-checkbox
                true-value="1"
                false-value="0"
                v-model="scope.row.isUnique"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tools:displayType')"
            min-width="12%"
          >
            <template #default="scope">
              <el-select v-model="scope.row.htmlType">
                <el-option
                  :label="$t('tools:textInput')"
                  value="input"
                />
                <el-option
                  :label="$t('tools:textArea')"
                  value="textarea"
                />
                <el-option
                  :label="$t('tools:dropdown')"
                  value="select"
                />
                <el-option
                  :label="$t('tools:radioButtons')"
                  value="radio"
                />
                <el-option
                  :label="$t('tools:checkboxes')"
                  value="checkbox"
                />
                <el-option
                  :label="$t('tools:dateNoTime')"
                  value="date"
                />
                <el-option
                  :label="$t('tools:timeOfDay')"
                  value="time"
                />
                <el-option
                  :label="$t('tools:dateAndTimeInstant')"
                  value="datetime"
                />
                <el-option
                  :label="$t('tools:imageUpload')"
                  value="imageUpload"
                />
                <el-option
                  :label="$t('tools:fileUpload')"
                  value="fileUpload"
                />
                <el-option
                  :label="$t('tools:richTextEditor')"
                  value="editor"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:dictionaryType')"
            min-width="12%"
          >
            <template #default="scope">
              <el-select
                v-model="scope.row.dictType"
                clearable
                filterable
                :placeholder="$t('system:select')"
              >
                <el-option
                  v-for="dict in dictOptions"
                  :key="dict.dictType"
                  :label="dict.dictName"
                  :value="dict.dictType"
                >
                  <span style="float: left">{{ dict.dictName }}</span>
                  <span style="float: right; color: #8492a6; font-size: 13px">{{
                    dict.dictType
                  }}</span>
                </el-option>
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane
        :label="$t('tools:generationSettings')"
        name="genInfo"
      >
        <gen-info-form
          ref="genInfo"
          :info="info"
          :tables="tables"
        />
      </el-tab-pane>
    </el-tabs>
    <el-form label-width="100px">
      <div style="text-align: center; margin-left: -100px; margin-top: 10px">
        <el-button
          type="primary"
          @click="submitForm()"
          >{{ $t('system:submit') }}</el-button
        >
        <el-button @click="close()">{{ $t('layout:error.back') }}</el-button>
      </div>
    </el-form>
  </el-card>
</template>

<script setup name="GenEdit">
import { t } from '@/i18n/adapter'
import { getGenTable, updateGenTable } from '@/api/tool/gen'
import { optionselect as getDictOptionselect } from '@/api/system/dict/type'
import basicInfoForm from './basicInfoForm'
import genInfoForm from './genInfoForm'
import Sortable from 'sortablejs'

const route = useRoute()
const { proxy } = getCurrentInstance()

const activeName = ref('columnInfo')
const tableHeight = ref(document.documentElement.scrollHeight - 245 + 'px')
const tables = ref([])
const columns = ref([])
const dictOptions = ref([])
const info = ref({})

/** 提交按钮 */
function submitForm() {
  const basicForm = proxy.$refs.basicInfo.$refs.basicInfoForm
  const genForm = proxy.$refs.genInfo.$refs.genInfoForm
  Promise.all([basicForm, genForm].map(getFormPromise)).then((res) => {
    const validateResult = res.every((item) => !!item)
    if (validateResult) {
      const genTable = Object.assign({}, info.value)
      genTable.columns = columns.value
      genTable.params = {
        genView: info.value.view ? '1' : '0',
        treeCode: info.value.treeCode,
        treeName: info.value.treeName,
        treeParentCode: info.value.treeParentCode,
        parentMenuId: info.value.parentMenuId,
      }
      updateGenTable(genTable).then((res) => {
        proxy.$modal.msgSuccess(res.msg)
        if (res.code === 200) {
          close()
        }
      })
    } else {
      proxy.$modal.msgError(t('tools:formValidationFailedCheckTheSubmittedValues'))
    }
  })
}

function getFormPromise(form) {
  return new Promise((resolve) => {
    form.validate((res) => {
      resolve(res)
    })
  })
}

function close() {
  const obj = { path: '/tool/gen', query: { t: Date.now(), pageNum: route.query.pageNum } }
  proxy.$tab.closeOpenPage(obj)
}

;(() => {
  const tableId = route.params && route.params.tableId
  if (tableId) {
    // 获取表详细信息
    getGenTable(tableId).then((res) => {
      columns.value = res.data.rows
      info.value = res.data.info
      tables.value = res.data.tables
    })
    /** 查询字典下拉列表 */
    getDictOptionselect().then((response) => {
      dictOptions.value = response.data
    })
  }
})()

// 拖动排序
onMounted(() => {
  const element = document.querySelector('.el-table__body > tbody')
  Sortable.create(element, {
    handle: '.allowDrag',
    onEnd: (evt) => {
      const targetRow = columns.value.splice(evt.oldIndex, 1)[0]
      columns.value.splice(evt.newIndex, 0, targetRow)
      for (const index in columns.value) {
        columns.value[index].sort = parseInt(index) + 1
      }
    },
  })
})
</script>
