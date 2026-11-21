import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
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
  useI18n()

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
          label={t('tool:generationTemplate')}
          rules={[{ required: true, message: t('tool:selectGenerationTemplate') }]}
        >
          <Select
            placeholder={t('common:selectPlaceholder')}
            options={[
              { label: t('tool:singleTableCrud'), value: 'crud' },
              { label: t('tool:treeTableCrud'), value: 'tree' },
              { label: t('tool:masterDetailTablesCrud'), value: 'sub' },
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
          label={t('tool:frontendType')}
          rules={[{ required: true, message: t('tool:chooseAFrontendType') }]}
        >
          <Select
            placeholder={t('common:selectPlaceholder')}
            options={[
              { label: t('tool:reactAntDesignTemplate'), value: 'react-antd' },
              { label: t('tool:vue2ElementUiTemplate'), value: 'element-ui' },
              { label: t('tool:vue3ElementPlusTemplate'), value: 'element-plus' },
            ]}
          />
        </Form.Item>
      </Col>
      {[
        [
          'packageName',
          t('tool:packagePath'),
          t('tool:forExampleModuleAdminSystem'),
          t('tool:targetPythonModuleEGModuleAdminSystemWhere'),
        ],
        [
          'moduleName',
          t('tool:moduleName'),
          t('tool:forExampleSystem'),
          t('tool:subsystemNameEGSystem'),
        ],
        [
          'businessName',
          t('tool:featureName'),
          t('tool:forExampleUser'),
          t('tool:englishFeatureNameEGUser'),
        ],
        [
          'functionName',
          t('tool:featureDescription'),
          t('tool:gen.forExampleUser'),
          t('tool:usedAsTheClassDescriptionEGUser'),
        ],
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
            rules={[{ required: true, message: t('monitor:enterValue', { label }) }]}
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
          label={t('tool:formLayout')}
          tooltip={{ title: t('tool:chooseTheFormGridLayout'), icon: <QuestionCircleFilled /> }}
        >
          <Select
            placeholder={t('common:selectPlaceholder')}
            options={[
              { label: t('tool:oneColumn'), value: 1 },
              { label: t('tool:twoColumns'), value: 2 },
              { label: t('tool:threeColumns'), value: 3 },
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
          label={t('tool:extraFeatures')}
          valuePropName="checked"
        >
          <Checkbox>{t('tool:generateDetailsPage')}</Checkbox>
        </Form.Item>
      </Col>
      <Col
        xs={24}
        md={12}
      >
        <Form.Item
          name="genType"
          label={t('tool:codeOutput')}
          tooltip={{
            title: t('tool:downloadAZipArchiveByDefaultOrChooseA'),
            icon: <QuestionCircleFilled />,
          }}
        >
          <Radio.Group
            options={[
              { label: t('tool:zipArchive'), value: '0' },
              { label: t('tool:customPath'), value: '1' },
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
          label={t('system:menu.parent')}
          tooltip={{
            title: t('tool:placeUnderAMenuEGSystemManagement'),
            icon: <QuestionCircleFilled />,
          }}
        >
          <TreeSelect
            placeholder={t('tool:selectSystemMenu')}
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
            label={t('tool:customPath')}
            tooltip={{
              title: t('tool:enterAnAbsolutePathIfEmptyFilesAreGenerated'),
              icon: <QuestionCircleFilled />,
            }}
          >
            <Space.Compact block>
              <Form.Item
                name="genPath"
                noStyle
              >
                <Input placeholder={t('tool:absoluteDiskPath')} />
              </Form.Item>
              <Dropdown
                menu={{
                  items: [{ key: 'default', label: t('tool:restoreTheDefaultOutputPath') }],
                  onClick: () => form.setFieldValue('genPath', '/'),
                }}
                trigger={['click']}
              >
                <Button>
                  {t('tool:chooseARecentPath')}
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
            <h4 className="form-header">{t('system:otherInformation')}</h4>
          </Col>
          {[
            ['treeCode', t('tool:treeIdColumn'), t('tool:columnContainingTreeNodeIdsEGDeptId')],
            [
              'treeParentCode',
              t('tool:treeParentIdColumn'),
              t('tool:columnContainingParentIdsEGParentId'),
            ],
            [
              'treeName',
              t('tool:treeNameColumn'),
              t('tool:columnContainingNodeDisplayNamesEGDeptName'),
            ],
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
                rules={[{ required: true, message: t('tool:selectValue', { label }) }]}
              >
                <Select
                  placeholder={t('common:selectPlaceholder')}
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
            <h4 className="form-header">{t('tool:relationships')}</h4>
          </Col>
          <Col
            xs={24}
            md={12}
          >
            <Form.Item
              name="subTableName"
              getValueProps={(value) => ({ value: value || undefined })}
              label={t('tool:relatedDetailTable')}
              tooltip={{
                title: t('tool:relatedDetailTableNameEGSysUser'),
                icon: <QuestionCircleFilled />,
              }}
              rules={[{ required: true }]}
            >
              <Select
                placeholder={t('common:selectPlaceholder')}
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
              label={t('tool:detailTableForeignKey')}
              tooltip={{
                title: t('tool:foreignKeyInTheDetailTableEGUser'),
                icon: <QuestionCircleFilled />,
              }}
              rules={[{ required: true }]}
            >
              <Select
                placeholder={t('common:selectPlaceholder')}
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
