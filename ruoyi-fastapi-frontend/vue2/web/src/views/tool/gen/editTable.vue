<template>
  <el-card>
    <el-tabs v-model="activeName">
      <el-tab-pane
        :label="$t('common:basicInfo')"
        name="basic"
      >
        <basic-info-form
          ref="basicInfo"
          :info="info"
        />
      </el-tab-pane>
      <el-tab-pane
        :label="$t('tool:messages.columnInformation')"
        name="columnInfo"
      >
        <el-table
          ref="dragTable"
          :data="columns"
          row-key="columnId"
          :max-height="tableHeight"
        >
          <el-table-column
            :label="$t('common:index')"
            type="index"
            min-width="5%"
            class-name="allowDrag"
          />
          <el-table-column
            :label="$t('tool:messages.columnName')"
            prop="columnName"
            min-width="10%"
            :show-overflow-tooltip="true"
            class-name="allowDrag"
          />
          <el-table-column
            :label="$t('tool:messages.columnDescription')"
            min-width="10%"
          >
            <template slot-scope="scope">
              <el-input v-model="scope.row.columnComment"></el-input>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tool:messages.databaseType')"
            prop="columnType"
            min-width="10%"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            :label="$t('tool:messages.pythonType')"
            min-width="11%"
          >
            <template slot-scope="scope">
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
            :label="$t('tool:messages.pythonAttribute')"
            min-width="10%"
          >
            <template slot-scope="scope">
              <el-input v-model="scope.row.pythonField"></el-input>
            </template>
          </el-table-column>

          <el-table-column
            :label="$t('tool:messages.insert')"
            min-width="5%"
          >
            <template slot-scope="scope">
              <el-checkbox
                true-label="1"
                false-label="0"
                v-model="scope.row.isInsert"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('common:editAction')"
            min-width="5%"
          >
            <template slot-scope="scope">
              <el-checkbox
                true-label="1"
                false-label="0"
                v-model="scope.row.isEdit"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:dict.list')"
            min-width="5%"
          >
            <template slot-scope="scope">
              <el-checkbox
                true-label="1"
                false-label="0"
                v-model="scope.row.isList"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('monitor:messages.search')"
            min-width="5%"
          >
            <template slot-scope="scope">
              <el-checkbox
                true-label="1"
                false-label="0"
                v-model="scope.row.isQuery"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tool:messages.queryMethod')"
            min-width="10%"
          >
            <template slot-scope="scope">
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
            :label="$t('pluginAdmin:messages.required')"
            min-width="5%"
          >
            <template slot-scope="scope">
              <el-checkbox
                true-label="1"
                false-label="0"
                v-model="scope.row.isRequired"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tool:messages.unique')"
            min-width="5%"
          >
            <template slot-scope="scope">
              <el-checkbox
                true-label="1"
                false-label="0"
                v-model="scope.row.isUnique"
              ></el-checkbox>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('tool:messages.displayType')"
            min-width="12%"
          >
            <template slot-scope="scope">
              <el-select v-model="scope.row.htmlType">
                <el-option
                  :label="$t('tool:messages.textInput')"
                  value="input"
                />
                <el-option
                  :label="$t('tool:messages.textArea')"
                  value="textarea"
                />
                <el-option
                  :label="$t('tool:messages.dropdown')"
                  value="select"
                />
                <el-option
                  :label="$t('tool:messages.radioButtons')"
                  value="radio"
                />
                <el-option
                  :label="$t('tool:messages.checkboxes')"
                  value="checkbox"
                />
                <el-option
                  :label="$t('tool:messages.dateNoTime')"
                  value="date"
                />
                <el-option
                  :label="$t('tool:messages.timeOfDay')"
                  value="time"
                />
                <el-option
                  :label="$t('tool:messages.dateAndTimeInstant')"
                  value="datetime"
                />
                <el-option
                  :label="$t('tool:messages.imageUpload')"
                  value="imageUpload"
                />
                <el-option
                  :label="$t('tool:messages.fileUpload')"
                  value="fileUpload"
                />
                <el-option
                  :label="$t('tool:messages.richTextEditor')"
                  value="editor"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column
            :label="$t('system:dict.type')"
            min-width="12%"
          >
            <template slot-scope="scope">
              <el-select
                v-model="scope.row.dictType"
                clearable
                filterable
                :placeholder="$t('common:selectPlaceholder')"
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
        :label="$t('tool:messages.generationSettings')"
        name="genInfo"
      >
        <gen-info-form
          ref="genInfo"
          :info="info"
          :tables="tables"
          :menus="menus"
        />
      </el-tab-pane>
    </el-tabs>
    <el-form
      :validate-on-rule-change="false"
      label-width="100px"
    >
      <el-form-item style="text-align: center; margin-left: -100px; margin-top: 10px">
        <el-button
          type="primary"
          @click="submitForm()"
          >{{ $t('common:submit') }}</el-button
        >
        <el-button @click="close()">{{ $t('layout:error.back') }}</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getGenTable, updateGenTable } from '@/api/tool/gen'
import { optionselect as getDictOptionselect } from '@/api/system/dict/type'
import { listMenu as getMenuTreeselect } from '@/api/system/menu'
import basicInfoForm from './basicInfoForm'
import genInfoForm from './genInfoForm'
import Sortable from 'sortablejs'

export default {
  name: 'GenEdit',
  components: {
    basicInfoForm,
    genInfoForm,
  },
  data() {
    return {
      // 选中选项卡的 name
      activeName: 'columnInfo',
      // 表格的高度
      tableHeight: document.documentElement.scrollHeight - 245 + 'px',
      // 表信息
      tables: [],
      // 表列信息
      columns: [],
      // 字典信息
      dictOptions: [],
      // 菜单信息
      menus: [],
      // 表详细信息
      info: {},
    }
  },
  created() {
    const tableId = this.$route.params && this.$route.params.tableId
    if (tableId) {
      // 获取表详细信息
      getGenTable(tableId).then((res) => {
        this.columns = res.data.rows
        this.info = res.data.info
        this.tables = res.data.tables
      })
      /** 查询字典下拉列表 */
      getDictOptionselect().then((response) => {
        this.dictOptions = response.data
      })
      /** 查询菜单下拉列表 */
      getMenuTreeselect().then((response) => {
        this.menus = this.handleTree(response.data, 'menuId')
      })
    }
  },
  methods: {
    /** 提交按钮 */
    submitForm() {
      const basicForm = this.$refs.basicInfo.$refs.basicInfoForm
      const genForm = this.$refs.genInfo.$refs.genInfoForm
      Promise.all([basicForm, genForm].map(this.getFormPromise)).then((res) => {
        const validateResult = res.every((item) => !!item)
        if (validateResult) {
          const genTable = Object.assign({}, basicForm.model, genForm.model)
          genTable.columns = this.columns
          genTable.params = {
            genView: genTable.view ? '1' : '0',
            treeCode: genTable.treeCode,
            treeName: genTable.treeName,
            treeParentCode: genTable.treeParentCode,
            parentMenuId: genTable.parentMenuId,
          }
          updateGenTable(genTable).then((res) => {
            this.$modal.msgSuccess(res.msg)
            if (res.code === 200) {
              this.close()
            }
          })
        } else {
          this.$modal.msgError(t('tool:messages.formValidationFailedCheckTheSubmittedValues'))
        }
      })
    },
    getFormPromise(form) {
      return new Promise((resolve) => {
        form.validate((res) => {
          resolve(res)
        })
      })
    },
    /** 关闭按钮 */
    close() {
      const obj = {
        path: '/tool/gen',
        query: { t: Date.now(), pageNum: this.$route.query.pageNum },
      }
      this.$tab.closeOpenPage(obj)
    },
  },
  mounted() {
    const el = this.$refs.dragTable.$el.querySelectorAll(
      '.el-table__body-wrapper > table > tbody'
    )[0]
    const sortable = Sortable.create(el, {
      handle: '.allowDrag',
      onEnd: (evt) => {
        const targetRow = this.columns.splice(evt.oldIndex, 1)[0]
        this.columns.splice(evt.newIndex, 0, targetRow)
        for (let index in this.columns) {
          this.columns[index].sort = parseInt(index) + 1
        }
      },
    })
  },
}
</script>
