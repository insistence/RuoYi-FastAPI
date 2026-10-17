import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  TreeSelect,
} from 'antd'
import { DownOutlined, QuestionCircleFilled } from '@ant-design/icons'
import { listMenu } from '@/api/system/menu'
import { handleTree } from '@/utils/ruoyi'
export default function GenInfoForm({ form, columns, tables }) {
  const [menus, setMenus] = useState([])
  const category = Form.useWatch('tplCategory', form)
  const genType = Form.useWatch('genType', form)
  const subTableName = Form.useWatch('subTableName', form)
  useEffect(() => {
    listMenu()
      .then((r) => setMenus(handleTree(r.data || [], 'menuId')))
      .catch(() => {})
  }, [])
  const columnOptions = columns.map((c) => ({
    label: `${c.columnName}：${c.columnComment}`,
    value: c.columnName,
  }))
  const subColumns = tables.find((t) => t.tableName === subTableName)?.columns || []
  return (
    <Row>
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="tplCategory"
          label="生成模板"
          rules={[{ required: true, message: '请选择生成模板' }]}
        >
          <Select
            placeholder="请选择"
            options={[
              { label: '单表（增删改查）', value: 'crud' },
              { label: '树表（增删改查）', value: 'tree' },
              { label: '主子表（增删改查）', value: 'sub' },
            ]}
            onChange={(value) => {
              if (value !== 'sub') form.setFieldsValue({ subTableName: '', subTableFkName: '' })
            }}
          />
        </Form.Item>
      </Col>
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="tplWebType"
          label="前端类型"
          rules={[{ required: true, message: '请选择前端类型' }]}
        >
          <Select
            placeholder="请选择"
            options={[
              { label: 'React Ant Design 模板', value: 'react-antd' },
              { label: 'Vue2 Element UI 模板', value: 'element-ui' },
              { label: 'Vue3 Element Plus 模板', value: 'element-plus' },
            ]}
          />
        </Form.Item>
      </Col>
      {[
        [
          'packageName',
          '生成包路径',
          '例如 module_admin.system',
          '生成在哪个python模块下，例如 module_admin.system，system为子系统名',
        ],
        ['moduleName', '生成模块名', '例如 system', '可理解为子系统名，例如 system'],
        ['businessName', '生成业务名', '例如 user', '可理解为功能英文名，例如 user'],
        ['functionName', '生成功能名', '例如 用户', '用作类描述，例如 用户'],
      ].map(([name, label, placeholder, help]) => (
        <Col
          xs={24}
          md={12}
          key={name}
        >
          <Form.Item
            name={name}
            label={label}
            tooltip={{ title: help, icon: <QuestionCircleFilled /> }}
            rules={[{ required: true, message: `请输入${label}` }]}
          >
            <Input placeholder={placeholder} />
          </Form.Item>
        </Col>
      ))}
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="formColNum"
          label="表单布局"
          tooltip={{ title: '选择表单的栅格布局方式', icon: <QuestionCircleFilled /> }}
        >
          <Select
            placeholder="请选择"
            options={[
              { label: '单列', value: 1 },
              { label: '双列', value: 2 },
              { label: '三列', value: 3 },
            ]}
          />
        </Form.Item>
      </Col>
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="view"
          label="扩展功能"
          valuePropName="checked"
        >
          <Checkbox>生成详情页</Checkbox>
        </Form.Item>
      </Col>
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="genType"
          label="生成代码方式"
          tooltip={{
            title: '默认为zip压缩包下载，也可以自定义生成路径',
            icon: <QuestionCircleFilled />,
          }}
        >
          <Radio.Group
            options={[
              { label: 'zip压缩包', value: '0' },
              { label: '自定义路径', value: '1' },
            ]}
          />
        </Form.Item>
      </Col>
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="parentMenuId"
          label="上级菜单"
          tooltip={{ title: '分配到指定菜单下，例如 系统管理', icon: <QuestionCircleFilled /> }}
        >
          <TreeSelect
            placeholder="请选择系统菜单"
            treeData={menus}
            fieldNames={{
              value: 'menuId',
              label: 'menuName',
              children: 'children',
            }}
            treeDefaultExpandAll
            allowClear
          />
        </Form.Item>
      </Col>
      {genType === '1' && (
        <Col span={24}>
          <Form.Item
            label="自定义路径"
            tooltip={{
              title: '填写磁盘绝对路径，若不填写，则生成到当前Web项目下',
              icon: <QuestionCircleFilled />,
            }}
          >
            <Space.Compact block>
              <Form.Item
                name="genPath"
                noStyle
              >
                <Input placeholder="磁盘绝对路径" />
              </Form.Item>
              <Dropdown
                menu={{
                  items: [{ key: 'default', label: '恢复默认的生成基础路径' }],
                  onClick: () => form.setFieldValue('genPath', '/'),
                }}
                trigger={['click']}
              >
                <Button>
                  最近路径快速选择
                  <DownOutlined />
                </Button>
              </Dropdown>
            </Space.Compact>
          </Form.Item>
        </Col>
      )}
      {category === 'tree' && (
        <>
          <Col span={24}>
            <h4 className="form-header">其他信息</h4>
          </Col>
          {[
            ['treeCode', '树编码字段', '树显示的编码字段名， 如：dept_id'],
            ['treeParentCode', '树父编码字段', '树显示的父编码字段名， 如：parent_id'],
            ['treeName', '树名称字段', '树节点的显示名称字段名， 如：dept_name'],
          ].map(([name, label, help]) => (
            <Col
              xs={24}
              md={12}
              key={name}
            >
              <Form.Item
                name={name}
                label={label}
                tooltip={{ title: help, icon: <QuestionCircleFilled /> }}
                rules={[{ required: true, message: `请选择${label}` }]}
              >
                <Select
                  placeholder="请选择"
                  options={columnOptions}
                />
              </Form.Item>
            </Col>
          ))}
        </>
      )}
      {category === 'sub' && (
        <>
          <Col span={24}>
            <h4 className="form-header">关联信息</h4>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <Form.Item
              name="subTableName"
              getValueProps={(value) => ({ value: value || undefined })}
              label="关联子表的表名"
              tooltip={{ title: '关联子表的表名， 如：sys_user', icon: <QuestionCircleFilled /> }}
              rules={[{ required: true }]}
            >
              <Select
                placeholder="请选择"
                options={tables.map((t) => ({
                  label: `${t.tableName}：${t.tableComment}`,
                  value: t.tableName,
                }))}
                onChange={() => form.setFieldValue('subTableFkName', '')}
              />
            </Form.Item>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <Form.Item
              name="subTableFkName"
              getValueProps={(value) => ({ value: value || undefined })}
              label="子表关联的外键名"
              tooltip={{ title: '子表关联的外键名， 如：user_id', icon: <QuestionCircleFilled /> }}
              rules={[{ required: true }]}
            >
              <Select
                placeholder="请选择"
                options={subColumns.map((c) => ({
                  label: `${c.columnName}：${c.columnComment}`,
                  value: c.columnName,
                }))}
              />
            </Form.Item>
          </Col>
        </>
      )}
    </Row>
  )
}
