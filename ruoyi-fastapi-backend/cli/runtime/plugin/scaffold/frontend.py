from plugins.core.frontend import FrontendFramework, PluginFrontendFrameworkResolver  # noqa: F401

from .frontend_api import PluginFrontendApiScaffoldTemplateBuilder
from .frontend_react import PluginReactFrontendScaffoldTemplateBuilder
from .frontend_vue2 import PluginVue2FrontendScaffoldTemplateBuilder
from .naming import PluginScaffoldNaming


class PluginVue3FrontendScaffoldTemplateBuilder(PluginFrontendApiScaffoldTemplateBuilder):
    """
    前端插件模板内容构建器。
    """

    @staticmethod
    def build_view(plugin_id: str) -> str:
        """
        构建前端视图模板内容。

        :param plugin_id: 插件ID
        :return: 前端视图模板内容
        """
        return f"""<template>
  <div class=\"app-container\">
    <el-card shadow=\"never\">
      <template #header>{plugin_id}</template>
      <div>{{{{ t('plugin.{plugin_id}:ready', {{ pluginId: '{plugin_id}' }}) }}}}</div>
    </el-card>
  </div>
</template>

<script setup>
import '../i18n'
import {{ t }} from '@/i18n/adapter'
</script>
"""

    @staticmethod
    def build_crud_view(plugin_id: str) -> str:
        """
        构建前端 CRUD 视图模板内容。

        :param plugin_id: 插件ID
        :return: 前端 CRUD 视图模板内容
        """
        class_name = PluginScaffoldNaming.to_class_name(plugin_id)
        return f"""<template>
  <div class=\"app-container\">
    <el-form :model=\"queryParams\" :inline=\"true\">
      <el-form-item :label=\"t('plugin.{plugin_id}:name')\">
        <el-input v-model=\"queryParams.keyword\" :placeholder=\"t('plugin.{plugin_id}:namePlaceholder')\" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type=\"primary\" icon=\"Search\" @click=\"getList\">{{{{ t('plugin.{plugin_id}:search') }}}}</el-button>
        <el-button icon=\"Refresh\" @click=\"resetQuery\">{{{{ t('plugin.{plugin_id}:reset') }}}}</el-button>
        <el-button type=\"primary\" plain icon=\"Plus\" @click=\"handleAdd\">{{{{ t('plugin.{plugin_id}:add') }}}}</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading=\"loading\" :data=\"itemList\" border>
      <el-table-column :label=\"t('plugin.{plugin_id}:id')\" prop=\"itemId\" width=\"90\" align=\"center\" />
      <el-table-column :label=\"t('plugin.{plugin_id}:name')\" prop=\"itemName\" min-width=\"180\" />
      <el-table-column :label=\"t('plugin.{plugin_id}:status')\" prop=\"status\" width=\"90\" align=\"center\">
        <template #default=\"scope\">
          <el-tag :type=\"scope.row.status === '0' ? 'success' : 'info'\">{{{{ scope.row.status === '0' ? t('plugin.{plugin_id}:enabled') : t('plugin.{plugin_id}:disabled') }}}}</el-tag>
        </template>
      </el-table-column>
      <el-table-column :label=\"t('plugin.{plugin_id}:remark')\" prop=\"remark\" min-width=\"220\" />
      <el-table-column :label=\"t('plugin.{plugin_id}:actions')\" width=\"150\" align=\"center\">
        <template #default=\"scope\">
          <el-button link type=\"primary\" icon=\"Edit\" @click=\"handleUpdate(scope.row)\">{{{{ t('plugin.{plugin_id}:edit') }}}}</el-button>
          <el-button link type=\"danger\" icon=\"Delete\" @click=\"handleDelete(scope.row)\">{{{{ t('plugin.{plugin_id}:delete') }}}}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog :title=\"dialogTitle\" v-model=\"open\" width=\"520px\" append-to-body>
      <el-form ref=\"itemRef\" :model=\"form\" :rules=\"rules\" :validate-on-rule-change=\"false\" label-width=\"90px\">
        <el-form-item :label=\"t('plugin.{plugin_id}:name')\" prop=\"itemName\">
          <el-input v-model=\"form.itemName\" :placeholder=\"t('plugin.{plugin_id}:namePlaceholder')\" />
        </el-form-item>
        <el-form-item :label=\"t('plugin.{plugin_id}:status')\" prop=\"status\">
          <el-radio-group v-model=\"form.status\">
            <el-radio label=\"0\">{{{{ t('plugin.{plugin_id}:enabled') }}}}</el-radio>
            <el-radio label=\"1\">{{{{ t('plugin.{plugin_id}:disabled') }}}}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label=\"t('plugin.{plugin_id}:remark')\" prop=\"remark\">
          <el-input v-model=\"form.remark\" type=\"textarea\" :rows=\"3\" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class=\"dialog-footer\">
          <el-button type=\"primary\" @click=\"submitForm\">{{{{ t('plugin.{plugin_id}:confirm') }}}}</el-button>
          <el-button @click=\"open = false\">{{{{ t('plugin.{plugin_id}:cancel') }}}}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name=\"{class_name}Plugin\">
import '../i18n'
import {{ t, localeState }} from '@/i18n/adapter'
import {{
  add{class_name}Item,
  del{class_name}Item,
  list{class_name}Items,
  update{class_name}Item
}} from '../api/{plugin_id}'

const {{ proxy }} = getCurrentInstance()

const loading = ref(false)
const open = ref(false)
const itemList = ref([])
const queryParams = reactive({{
  keyword: ''
}})
const form = reactive({{
  itemId: undefined,
  itemName: '',
  status: '0',
  remark: ''
}})
const dialogTitle = computed(() => form.itemId
  ? t('plugin.{plugin_id}:editTitle', {{ pluginId: '{plugin_id}' }})
  : t('plugin.{plugin_id}:addTitle', {{ pluginId: '{plugin_id}' }}))
const rules = computed(() => ({{
  itemName: [{{ required: true, message: t('plugin.{plugin_id}:nameRequired'), trigger: 'blur' }}]
}}))
watch(() => localeState.locale, () => {{
  const fields = (proxy.$refs.itemRef?.fields || []).filter(field => field.validateState === 'error').map(field => field.prop)
  nextTick(() => {{ if (fields.length) proxy.$refs.itemRef?.validateField(fields, () => {{}}) }})
}})

function resetForm() {{
  form.itemId = undefined
  form.itemName = ''
  form.status = '0'
  form.remark = ''
}}

function getList() {{
  loading.value = true
  list{class_name}Items(queryParams).then(response => {{
    const data = response.data || response
    itemList.value = data.rows || []
  }}).finally(() => {{
    loading.value = false
  }})
}}

function resetQuery() {{
  queryParams.keyword = ''
  getList()
}}

function handleAdd() {{
  resetForm()
  open.value = true
}}

function handleUpdate(row) {{
  resetForm()
  form.itemId = row.itemId
  form.itemName = row.itemName
  form.status = row.status
  form.remark = row.remark
  open.value = true
}}

function submitForm() {{
  proxy.$refs.itemRef.validate(valid => {{
    if (!valid) {{
      return
    }}
    const request = form.itemId ? update{class_name}Item(form.itemId, form) : add{class_name}Item(form)
    request.then(() => {{
      proxy.$modal.msgSuccess(t('plugin.{plugin_id}:saved'))
      open.value = false
      getList()
    }})
  }})
}}

function handleDelete(row) {{
  proxy.$modal.confirm(t('plugin.{plugin_id}:deleteConfirm', {{ name: row.itemName }})).then(function () {{
    return del{class_name}Item(row.itemId)
  }}).then(() => {{
    proxy.$modal.msgSuccess(t('plugin.{plugin_id}:deleted'))
    getList()
  }})
}}

getList()
</script>
"""

    @staticmethod
    def build_readme(plugin_id: str) -> str:
        """
        构建前端 README 内容。

        :param plugin_id: 插件ID
        :return: 前端 README 内容
        """
        return f"""# {plugin_id} frontend plugin

Frontend plugin scaffold generated by `ruoyi plugin create`.

## Structure

- `api/`: request wrappers used by plugin pages.
- `views/`: Vue pages loaded by backend menu component paths.
- `../../tests/plugins/{plugin_id}/`: frontend node tests for plugin view resolving.

## Route Component

The backend menu component `plugin/{plugin_id}/index` maps to:

```text
plugins/{plugin_id}/views/index.vue
```
"""

    @staticmethod
    def build_test(plugin_id: str) -> str:
        """
        构建前端插件 node 测试样例。

        :param plugin_id: 插件ID
        :return: 前端插件测试样例内容
        """
        return f"""import assert from 'node:assert/strict'
import {{ existsSync }} from 'node:fs'
import {{ dirname, resolve }} from 'node:path'
import {{ fileURLToPath }} from 'node:url'

import {{ resolvePluginViewPath }} from '../../../src/utils/pluginViewResolver.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const frontendRoot = resolve(__dirname, '../../..')
const viewPath = resolve(frontendRoot, 'plugins', '{plugin_id}', 'views', 'index.vue')

assert.equal(resolvePluginViewPath('plugin/{plugin_id}/index'), '../../../plugins/{plugin_id}/views/index.vue')
assert.equal(existsSync(viewPath), true)

console.log('{plugin_id} plugin frontend tests passed')
"""


class PluginFrontendScaffoldTemplateBuilder:
    """
    根据目标前端框架分派已实现的插件源码模板。
    """

    @staticmethod
    def build_api(plugin_id: str) -> str:
        return PluginFrontendApiScaffoldTemplateBuilder.build_api(plugin_id)

    @staticmethod
    def build_crud_api(plugin_id: str) -> str:
        return PluginFrontendApiScaffoldTemplateBuilder.build_crud_api(plugin_id)

    @classmethod
    def view_filename(cls, frontend_framework: FrontendFramework = 'vue3') -> str:
        """验证框架并返回该宿主加载的页面文件名。"""
        cls._resolve_builder(frontend_framework)
        return 'index.jsx' if frontend_framework == 'react' else 'index.vue'

    @classmethod
    def build_view(cls, plugin_id: str, frontend_framework: FrontendFramework = 'vue3') -> str:
        return cls._resolve_builder(frontend_framework).build_view(plugin_id)

    @classmethod
    def build_crud_view(cls, plugin_id: str, frontend_framework: FrontendFramework = 'vue3') -> str:
        return cls._resolve_builder(frontend_framework).build_crud_view(plugin_id)

    @classmethod
    def build_readme(cls, plugin_id: str, frontend_framework: FrontendFramework = 'vue3') -> str:
        return cls._resolve_builder(frontend_framework).build_readme(plugin_id)

    @classmethod
    def build_test(cls, plugin_id: str, frontend_framework: FrontendFramework = 'vue3') -> str:
        return cls._resolve_builder(frontend_framework).build_test(plugin_id)

    @staticmethod
    def _resolve_builder(
        frontend_framework: FrontendFramework,
    ) -> (
        type[PluginVue2FrontendScaffoldTemplateBuilder]
        | type[PluginVue3FrontendScaffoldTemplateBuilder]
        | type[PluginReactFrontendScaffoldTemplateBuilder]
    ):
        if frontend_framework == 'vue2':
            return PluginVue2FrontendScaffoldTemplateBuilder
        if frontend_framework == 'vue3':
            return PluginVue3FrontendScaffoldTemplateBuilder
        if frontend_framework == 'react':
            return PluginReactFrontendScaffoldTemplateBuilder
        raise ValueError(f'暂不支持前端框架 {frontend_framework} 的源码模板，目前仅支持 vue2、vue3、react')
