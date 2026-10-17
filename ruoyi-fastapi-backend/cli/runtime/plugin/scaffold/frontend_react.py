from .naming import PluginScaffoldNaming


class PluginReactFrontendScaffoldTemplateBuilder:
    """使用 React Hooks 与宿主 Ant Design 组件生成插件源码页面。"""

    @staticmethod
    def build_view(plugin_id: str) -> str:
        """生成与基础 Vue 模板相同的插件信息卡片。"""
        class_name = PluginScaffoldNaming.to_class_name(plugin_id)
        return f"""import {{ Card }} from 'antd';

export default function {class_name}Plugin() {{
  return (
    <div className="app-container">
      <Card title="{plugin_id}">
        <div>{plugin_id} plugin</div>
      </Card>
    </div>
  );
}}
"""

    @staticmethod
    def build_crud_view(plugin_id: str) -> str:
        """生成筛选、列表和编辑弹窗，复用宿主请求及消息组件。"""
        class_name = PluginScaffoldNaming.to_class_name(plugin_id)
        return f"""import {{ useEffect, useState }} from 'react';
import {{ Button, Form, Input, Modal, Radio, Space, Table, Tag }} from 'antd';
import TableActions, {{ TableAction }} from '@/components/TableActions';
import {{ DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined }} from '@ant-design/icons';
import {{ confirm, message }} from '@/plugins/modal';
import {{ renderDialogFooter }} from '@/components/DialogFooter';
import {{
  add{class_name}Item,
  del{class_name}Item,
  list{class_name}Items,
  update{class_name}Item
}} from '../api/{plugin_id}';

const emptyForm = {{ itemName: '', status: '0', remark: '' }};

export default function {class_name}Plugin() {{
  const [queryForm] = Form.useForm();
  const [form] = Form.useForm();
  const [query, setQuery] = useState({{ keyword: '' }});
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {{
    let active = true;
    setLoading(true);
    list{class_name}Items(query)
      .then((response) => {{
        if (active) {{
          const data = response.data || response;
          setItems(data.rows || []);
        }}
      }})
      .catch(() => {{ /* 请求工具统一显示接口错误。 */ }})
      .finally(() => {{
        if (active) setLoading(false);
      }});
    return () => {{ active = false; }};
  }}, [query, revision]);

  function openEditor(row = null) {{
    form.resetFields();
    form.setFieldsValue({{ ...emptyForm, ...row }});
    setEditing(row || {{}});
  }}

  function resetQuery() {{
    queryForm.resetFields();
    setQuery({{ keyword: '' }});
  }}

  async function save(values) {{
    if (saving) return;
    setSaving(true);
    try {{
      if (editing.itemId != null) {{
        await update{class_name}Item(editing.itemId, values);
      }} else {{
        await add{class_name}Item(values);
      }}
      message.success('保存成功');
      setEditing(null);
      setRevision((value) => value + 1);
    }} catch {{
      // 请求工具统一显示接口错误，保留表单供重试。
    }} finally {{
      setSaving(false);
    }}
  }}

  async function remove(row) {{
    try {{
      await confirm('确认删除数据“' + row.itemName + '”吗？');
      await del{class_name}Item(row.itemId);
      message.success('删除成功');
      setRevision((value) => value + 1);
    }} catch {{
      // 取消确认或请求失败时保留列表。
    }}
  }}

  const columns = [
    {{ title: 'ID', dataIndex: 'itemId', width: 90, align: 'center' }},
    {{ title: '名称', dataIndex: 'itemName', width: 180 }},
    {{
      title: '状态', dataIndex: 'status', width: 90, align: 'center',
      render: (status) => <Tag color={{status === '0' ? 'success' : 'default'}}>{{status === '0' ? '正常' : '停用'}}</Tag>
    }},
    {{ title: '备注', dataIndex: 'remark', width: 220 }},
    {{
      title: '操作', width: 150, align: 'center',
      render: (_, row) => (
        <TableActions>
          <TableAction symbol="Edit" onClick={{() => openEditor(row)}}>修改</TableAction>
          <TableAction symbol="Delete" tone="danger" onClick={{() => remove(row)}}>删除</TableAction>
        </TableActions>
      )
    }}
  ];

  return (
    <div className="app-container">
      <Form form={{queryForm}} layout="inline" className="search-form" onFinish={{(values) => setQuery({{ keyword: values.keyword || '' }})}}>
        <Form.Item name="keyword" label="名称">
          <Input placeholder="请输入名称" allowClear />
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" icon={{<SearchOutlined />}}>搜索</Button>
            <Button icon={{<ReloadOutlined />}} onClick={{resetQuery}}>重置</Button>
            <Button className="ruoyi-plain-button ruoyi-plain-button--primary" icon={{<PlusOutlined />}} onClick={{() => openEditor()}}>新增</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table rowKey="itemId" loading={{loading}} columns={{columns}} dataSource={{items}} bordered pagination={{false}} scroll={{{{ x: 760 }}}} />
      <Modal
        title={{editing?.itemId != null ? '修改{plugin_id}' : '新增{plugin_id}'}}
        open={{editing !== null}}
        width={{520}}
        onCancel={{() => {{ if (!saving) setEditing(null); }}}}
        onOk={{() => form.submit()}}
        okText="确定"
        cancelText="取消"
        footer={{renderDialogFooter}}
        confirmLoading={{saving}}
        cancelButtonProps={{{{ disabled: saving }}}}
        closable={{!saving}}
        mask={{{{ closable: !saving }}}}
        keyboard={{!saving}}
        forceRender
      >
        <Form form={{form}} className="ruoyi-dialog-form" layout="horizontal" colon={{false}} labelCol={{{{ flex: '90px' }}}} wrapperCol={{{{ flex: '1 1 0' }}}} onFinish={{save}}>
          <Form.Item name="itemName" label="名称" rules={{[{{ required: true, whitespace: true, message: '名称不能为空' }}]}}>
            <Input placeholder="请输入名称" disabled={{saving}} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Radio.Group disabled={{saving}} options={{[{{ label: '正常', value: '0' }}, {{ label: '停用', value: '1' }}]}} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={{3}} disabled={{saving}} />
          </Form.Item>
          <button type="submit" hidden aria-hidden="true" tabIndex={{-1}} />
        </Form>
      </Modal>
    </div>
  );
}}
"""

    @staticmethod
    def build_readme(plugin_id: str) -> str:
        """生成 React 宿主接入和测试说明。"""
        return f"""# {plugin_id} React frontend plugin

Generated by `ruoyi plugin create --frontend-framework=react`.
Use the existing React Web host with React, Ant Design and @ant-design/icons.

- `api/`: request wrappers using the host request client.
- `views/index.jsx`: React page loaded by the backend menu `plugin/{plugin_id}/index`.
- `../../tests/plugins/{plugin_id}/pluginView.test.js`: Node.js route mapping smoke test.

From the React Web host, run:

~~~sh
node --test tests/plugins/{plugin_id}/pluginView.test.js
pnpm build
~~~

Select the same host for backend plugin commands with
`RUOYI_PLUGIN_FRONTEND_FRAMEWORK=react`.
Declare extra packages under `dependencies.frontend.react` in the backend plugin.yaml.
The CRUD template uses the same demo backend and fields as the Vue templates.
Its data is in memory until you replace the generated service with persistent storage.
"""

    @staticmethod
    def build_test(plugin_id: str) -> str:
        """生成可由 plugin test 调用的 React 路由解析测试。"""
        return f"""import assert from 'node:assert/strict';
import {{ existsSync }} from 'node:fs';
import {{ dirname, resolve }} from 'node:path';
import {{ fileURLToPath }} from 'node:url';
import {{ test }} from 'node:test';

import {{ resolvePluginViewPath }} from '../../../src/utils/pluginViewResolver.js';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('{plugin_id} React plugin view resolves to its generated JSX page', () => {{
  assert.equal(resolvePluginViewPath('plugin/{plugin_id}/index'), '../../plugins/{plugin_id}/views/index.jsx');
  assert.equal(existsSync(resolve(frontendRoot, 'plugins', '{plugin_id}', 'views', 'index.jsx')), true);
  assert.equal(existsSync(resolve(frontendRoot, 'plugins', '{plugin_id}', 'api', '{plugin_id}.js')), true);
}});
"""
