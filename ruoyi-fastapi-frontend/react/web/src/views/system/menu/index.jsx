import { useLocalizedFormErrors } from '@/i18n/form'
import TranslationFields, { SourceLocaleLabel } from '@/components/TranslationFields'
import { translationPatch, localizeOptions } from '@/i18n/entities.mjs'
import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
import TableActions, { TableAction } from '@/components/TableActions'
import { renderDialogFooter } from '@/components/DialogFooter'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Tag,
  TreeSelect,
} from 'antd'
import Table from '@/components/Table'
import { listMenu, getMenu, delMenu, addMenu, updateMenu, updateMenuSort } from '@/api/system/menu'
import { useDict } from '@/utils/dict'
import { handleTree } from '@/utils/ruoyi'
import { checkPermi } from '@/utils/permission'
import { message, confirm } from '@/plugins/modal'
import HasPermi from '@/directive/permission/hasPermi'
import DictTag from '@/components/DictTag'
import IconSelect from '@/components/IconSelect'
import FormLabel from '@/components/FormLabel'
import SvgIcon from '@/components/SvgIcon'
import RightToolbar from '@/components/RightToolbar'
import './style.css'

export default function Menu() {
  useI18n()
  const [originalTranslations, setOriginalTranslations] = useState({})

  const { sys_normal_disable, sys_show_hide } = useDict('sys_normal_disable', 'sys_show_hide')
  const [queryRef] = Form.useForm(),
    [menuRef] = Form.useForm()
  useLocalizedFormErrors(queryRef, menuRef)
  const menuType = Form.useWatch('menuType', menuRef)
  const [rows, setRows] = useState([]),
    [orders, setOrders] = useState({}),
    [expanded, setExpanded] = useState([]),
    [menuOptions, setMenuOptions] = useState([])
  const [menuId, setMenuId] = useState(),
    [query, setQuery] = useState({}),
    [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true)
  const getList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listMenu(query)
      setRows(result.data)
      setOrders({})
    } catch {
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => {
    void getList()
  }, [getList])
  async function loadOptions(exclude) {
    const result = await listMenu()
    const nodes = handleTree(result.data, 'menuId')
    const filter = (rows) =>
      rows
        .filter((row) => row.menuId !== exclude)
        .map((row) => ({
          ...row,
          children: row.children && filter(row.children),
        }))
    setMenuOptions([{ menuId: 0, menuName: '', children: filter(nodes) }])
  }
  async function handleAdd(parent) {
    try {
      await loadOptions()
      setMenuId(undefined)
      menuRef.resetFields()
      setOriginalTranslations({})
      menuRef.setFieldsValue({
        parentId: parent?.menuId || 0,
        menuType: 'M',
        orderNum: 0,
        isFrame: 1,
        isCache: 0,
        visible: '0',
        status: '0',
      })
      setOpen(true)
    } catch {}
  }
  async function handleUpdate(row) {
    try {
      const [, result] = await Promise.all([loadOptions(row.menuId), getMenu(row.menuId)])
      setMenuId(row.menuId)
      menuRef.resetFields()
      setOriginalTranslations({})
      menuRef.setFieldsValue(result.data)
      setOriginalTranslations(result.data.menuNameI18n || {})
      setOpen(true)
    } catch {}
  }
  async function handleDelete(row) {
    try {
      await confirm(t('system:deleteTheItemNamedValue', { menuName: row.menuName }))
      await delMenu(row.menuId)
      message.success(t('common:deleteSuccess'))
      await getList()
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await menuRef.validateFields()
      values.menuNameI18n = translationPatch(values.menuNameI18n, originalTranslations)
      setSaving(true)
      await (menuId !== undefined ? updateMenu({ ...values, menuId }) : addMenu(values))
      message.success(t('system:savedSuccessfully'))
      setOpen(false)
      await getList()
    } catch {
    } finally {
      setSaving(false)
    }
  }
  async function handleSaveSort() {
    const changed = rows.filter(
      (row) =>
        orders[row.menuId] !== undefined && String(orders[row.menuId]) !== String(row.orderNum)
    )
    if (!changed.length) return message.warning(t('system:noSortOrderChangesDetected'))
    try {
      await updateMenuSort({
        menuIds: changed.map((row) => row.menuId).join(','),
        orderNums: changed.map((row) => orders[row.menuId]).join(','),
      })
      message.success(t('system:sortOrderSaved'))
      await getList()
    } catch {}
  }
  const columns = [
    {
      title: t('system:menu.name'),
      dataIndex: 'menuName',
      width: 220,
      ellipsis: true,
      render: (value, row) => (
        <span title={i18n.resolveText(value, row.menuNameI18n)}>
          <SvgIcon iconClass={row.icon} />
          <span style={{ marginLeft: 5 }}>{i18n.resolveText(value, row.menuNameI18n)}</span>
        </span>
      ),
    },
    {
      title: t('common:type'),
      dataIndex: 'menuType',
      width: 100,
      render: (value, row) => {
        const [label, color] =
          (value === 'M' || value === 'C') && String(row.isFrame) === '0'
            ? [t('system:menu.external'), 'error']
            : {
                M: [t('system:menu.directory'), 'processing'],
                C: [t('system:menu.menu'), 'success'],
                F: [t('system:menu.button'), 'warning'],
              }[value] || []
        return label ? (
          <Tag
            className="dict-tag menu-type-tag"
            color={color}
          >
            {label}
          </Tag>
        ) : null
      },
    },
    {
      title: t('common:sort'),
      dataIndex: 'orderNum',
      width: 200,
      render: (value, row) => (
        <InputNumber
          className="menu-sort-input"
          style={{ width: 88 }}
          min={0}
          precision={0}
          value={orders[row.menuId] ?? value}
          disabled={!checkPermi(['system:menu:edit'])}
          onChange={(value) => setOrders({ ...orders, [row.menuId]: value ?? 0 })}
        />
      ),
    },
    { title: t('system:menu.permission'), dataIndex: 'perms', ellipsis: true },
    { title: t('system:menu.component'), dataIndex: 'component', ellipsis: true },
    {
      title: t('common:status'),
      dataIndex: 'status',
      width: 80,
      render: (value) => (
        <DictTag
          options={sys_normal_disable}
          value={value}
        />
      ),
    },
    {
      className: 'ruoyi-actions-cell',
      align: 'center',
      title: t('common:actions'),
      width: 210,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={['system:menu:edit']}>
            <TableAction
              symbol="Edit"
              onClick={() => handleUpdate(row)}
            >
              {t('common:edit')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:menu:add']}>
            <TableAction
              symbol="Plus"
              onClick={() => handleAdd(row)}
            >
              {t('common:add')}
            </TableAction>
          </HasPermi>
          <HasPermi value={['system:menu:remove']}>
            <TableAction
              symbol="Delete"
              onClick={() => handleDelete(row)}
            >
              {t('common:delete')}
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ]
  return (
    <div className="app-container">
      {showSearch && (
        <Form
          form={queryRef}
          className="search-form"
          layout="inline"
          onFinish={setQuery}
        >
          <Form.Item
            name="menuName"
            label={<SourceLocaleLabel>{t('system:menu.name')}</SourceLocaleLabel>}
          >
            <Input
              style={{ width: 200 }}
              placeholder={t('system:menu.placeholder')}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="status"
            label={t('common:status')}
          >
            <Select
              style={{ width: 200 }}
              placeholder={t('system:menuStatus')}
              allowClear
              options={sys_normal_disable}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                icon={<SearchOutlined />}
                htmlType="submit"
                type="primary"
              >
                {t('common:search')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields()
                  setQuery({})
                }}
              >
                {t('common:reset')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={['system:menu:add']}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={() => handleAdd()}
          >
            {t('common:add')}
          </Button>
        </HasPermi>
        <HasPermi value={['system:menu:edit']}>
          <Button
            icon={<CheckOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={handleSaveSort}
          >
            {t('system:saveSortOrder')}
          </Button>
        </HasPermi>
        <Button
          className="ruoyi-plain-button ruoyi-plain-button--info"
          type="default"
          onClick={() => setExpanded(expanded.length ? [] : rows.map((row) => row.menuId))}
        >
          {t('system:expandCollapse')}
        </Button>
        <RightToolbar
          showSearch={showSearch}
          onShowSearch={setShowSearch}
          onQuery={getList}
        />
      </div>
      <Table
        className="menu-table"
        size="small"
        rowKey="menuId"
        dataSource={handleTree(
          rows.map((row) => ({ ...row })),
          'menuId'
        )}
        columns={columns}
        loading={loading}
        pagination={false}
        expandable={{
          expandedRowKeys: expanded,
          onExpandedRowsChange: setExpanded,
          indentSize: 16,
          expandIcon: ({ expanded, onExpand, record }) =>
            record.children?.length ? (
              <button
                type="button"
                className="menu-tree-toggle"
                aria-label={`${expanded ? t('common:collapse') : t('common:expand')}${record.menuName}`}
                aria-expanded={expanded}
                onClick={(event) => onExpand(record, event)}
              >
                {expanded ? <DownOutlined /> : <RightOutlined />}
              </button>
            ) : (
              <span className="menu-tree-toggle-placeholder" />
            ),
        }}
        scroll={{ x: 1000 }}
      />
      <Modal
        footer={renderDialogFooter}
        title={menuId !== undefined ? t('system:menu.edit') : t('system:menu.add')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        width="680px"
        forceRender
      >
        <Form
          name="src-views-system-menu-index-jsx-editor-11"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '100px' }}
          form={menuRef}
          layout="horizontal"
        >
          <Row gutter={20}>
            <Col
              xs={24}
              sm={24}
            >
              <Form.Item
                label={t('system:menu.parent')}
                name="parentId"
              >
                <TreeSelect
                  placeholder={t('system:chooseAParentMenu')}
                  fieldNames={{
                    value: 'menuId',
                    label: 'label',
                    children: 'children',
                  }}
                  treeData={localizeOptions(
                    menuOptions,
                    i18n.resolveText,
                    'menuName',
                    'menuNameI18n'
                  ).map((node) =>
                    node.menuId === 0 ? { ...node, label: t('system:menu.root') } : node
                  )}
                  treeDefaultExpandAll
                  showSearch
                  treeNodeFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={24}
            >
              <Form.Item
                name="menuType"
                label={t('system:menu.type')}
              >
                <Radio.Group
                  options={[
                    { value: 'M', label: t('system:menu.directory') },
                    { value: 'C', label: t('system:menu.menu') },
                    { value: 'F', label: t('system:menu.button') },
                  ]}
                />
              </Form.Item>
            </Col>
            {menuType !== 'F' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="icon"
                  label={t('system:menuIcon')}
                >
                  <IconSelect placeholder={t('common:clickToChooseAnIcon')} />
                </Form.Item>
              </Col>
            )}
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="orderNum"
                label={t('system:dept.order')}
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="menuName"
                label={<SourceLocaleLabel>{t('system:menu.name')}</SourceLocaleLabel>}
                rules={[{ required: true }]}
              >
                <Input placeholder={t('system:menu.placeholder')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <TranslationFields
                name="menuNameI18n"
                label={t('system:menu.name')}
              />
            </Col>
            {menuType === 'C' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="routeName"
                  label={
                    <FormLabel
                      label={t('system:routeName')}
                      help={t('system:defaultsToTheRoutePathWithItsFirstLetterCapitalized')}
                    />
                  }
                >
                  <Input placeholder={t('system:enterARouteName')} />
                </Form.Item>
              </Col>
            )}
            {menuType !== 'F' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="isFrame"
                  label={
                    <FormLabel
                      label={t('system:externalLink')}
                      help={t('system:externalLinkPathsMustStartWithHttpOrHttps')}
                    />
                  }
                >
                  <Radio.Group
                    options={[
                      { value: 0, label: t('common:yes') },
                      { value: 1, label: t('common:no') },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}
            {menuType !== 'F' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="path"
                  label={
                    <FormLabel
                      label={t('system:routePath')}
                      help={t('system:routePathEGUserToEmbedAnExternalPage')}
                    />
                  }
                  rules={[{ required: true }]}
                >
                  <Input placeholder={t('system:enterARoutePath')} />
                </Form.Item>
              </Col>
            )}
            {menuType === 'C' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="component"
                  label={
                    <FormLabel
                      label={t('system:menu.component')}
                      help={t('system:componentPathRelativeToViewsEGSystemUserIndex')}
                    />
                  }
                >
                  <Input placeholder={t('system:enterAComponentPath')} />
                </Form.Item>
              </Col>
            )}
            {menuType !== 'M' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="perms"
                  label={
                    <FormLabel
                      label={t('system:permission.code')}
                      help={t(
                        'system:permissionDefinedInTheControllerEGUserinterfaceauthdependencySystemUser'
                      )}
                    />
                  }
                >
                  <Input
                    placeholder={t('system:enterAPermissionIdentifier')}
                    maxLength={100}
                  />
                </Form.Item>
              </Col>
            )}
            {menuType === 'C' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="query"
                  label={
                    <FormLabel
                      label={t('system:routeParameters')}
                      help={t('system:defaultParametersForThisRouteEGId1')}
                    />
                  }
                >
                  <Input
                    placeholder={t('system:enterRouteParameters')}
                    maxLength={255}
                  />
                </Form.Item>
              </Col>
            )}
            {menuType === 'C' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="isCache"
                  label={
                    <FormLabel
                      label={t('system:cacheEnabled')}
                      help={t(
                        'system:cachingPreservesPageStateWhenSwitchingPagesDisablingCachingReloads'
                      )}
                    />
                  }
                >
                  <Radio.Group
                    options={[
                      { value: 0, label: t('system:cache') },
                      { value: 1, label: t('system:doNotCache') },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}
            {menuType !== 'F' && (
              <Col
                xs={24}
                sm={12}
              >
                <Form.Item
                  name="visible"
                  label={
                    <FormLabel
                      label={t('system:visibility')}
                      help={t('system:hiddenRoutesRemainAccessibleButDoNotAppearInThe')}
                    />
                  }
                >
                  <Radio.Group options={sys_show_hide} />
                </Form.Item>
              </Col>
            )}
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="status"
                label={
                  <FormLabel
                    label={t('system:menuStatus')}
                    help={t('system:disabledRoutesDoNotAppearInTheSidebarAndCannot')}
                  />
                }
              >
                <Radio.Group options={sys_normal_disable} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
