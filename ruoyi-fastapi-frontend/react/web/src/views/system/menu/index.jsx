import TableActions, { TableAction } from "@/components/TableActions";
import { renderDialogFooter } from "@/components/DialogFooter";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckOutlined,
  DownOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
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
} from "antd";
import Table from "@/components/Table";
import { listMenu, getMenu, delMenu, addMenu, updateMenu, updateMenuSort } from "@/api/system/menu";
import { useDict } from "@/utils/dict";
import { handleTree } from "@/utils/ruoyi";
import { checkPermi } from "@/utils/permission";
import { message, confirm } from "@/plugins/modal";
import HasPermi from "@/directive/permission/hasPermi";
import DictTag from "@/components/DictTag";
import IconSelect from "@/components/IconSelect";
import FormLabel from "@/components/FormLabel";
import SvgIcon from "@/components/SvgIcon";
import RightToolbar from "@/components/RightToolbar";
import "./style.css";

export default function Menu() {
  const { sys_normal_disable, sys_show_hide } = useDict("sys_normal_disable", "sys_show_hide");
  const [queryRef] = Form.useForm(),
    [menuRef] = Form.useForm();
  const menuType = Form.useWatch("menuType", menuRef);
  const [rows, setRows] = useState([]),
    [orders, setOrders] = useState({}),
    [expanded, setExpanded] = useState([]),
    [menuOptions, setMenuOptions] = useState([]);
  const [menuId, setMenuId] = useState(),
    [query, setQuery] = useState({}),
    [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [showSearch, setShowSearch] = useState(true);
  const getList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMenu(query);
      setRows(result.data);
      setOrders({});
    } catch {
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void getList();
  }, [getList]);
  async function loadOptions(exclude) {
    const result = await listMenu();
    const nodes = handleTree(result.data, "menuId");
    const filter = (rows) =>
      rows
        .filter((row) => row.menuId !== exclude)
        .map((row) => ({
          ...row,
          children: row.children && filter(row.children),
        }));
    setMenuOptions([{ menuId: 0, menuName: "主类目", children: filter(nodes) }]);
  }
  async function handleAdd(parent) {
    try {
      await loadOptions();
      setMenuId(undefined);
      menuRef.resetFields();
      menuRef.setFieldsValue({
        parentId: parent?.menuId || 0,
        menuType: "M",
        orderNum: 0,
        isFrame: 1,
        isCache: 0,
        visible: "0",
        status: "0",
      });
      setOpen(true);
    } catch {}
  }
  async function handleUpdate(row) {
    try {
      const [, result] = await Promise.all([loadOptions(row.menuId), getMenu(row.menuId)]);
      setMenuId(row.menuId);
      menuRef.resetFields();
      menuRef.setFieldsValue(result.data);
      setOpen(true);
    } catch {}
  }
  async function handleDelete(row) {
    try {
      await confirm(`是否确认删除名称为“${row.menuName}”的数据项？`);
      await delMenu(row.menuId);
      message.success("删除成功");
      await getList();
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await menuRef.validateFields();
      setSaving(true);
      await (menuId !== undefined ? updateMenu({ ...values, menuId }) : addMenu(values));
      message.success("保存成功");
      setOpen(false);
      await getList();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  async function handleSaveSort() {
    const changed = rows.filter(
      (row) =>
        orders[row.menuId] !== undefined && String(orders[row.menuId]) !== String(row.orderNum),
    );
    if (!changed.length) return message.warning("未检测到排序修改");
    try {
      await updateMenuSort({
        menuIds: changed.map((row) => row.menuId).join(","),
        orderNums: changed.map((row) => orders[row.menuId]).join(","),
      });
      message.success("排序保存成功");
      await getList();
    } catch {}
  }
  const columns = [
    {
      title: "菜单名称",
      dataIndex: "menuName",
      width: 220,
      ellipsis: true,
      render: (value, row) => (
        <span title={value}>
          <SvgIcon iconClass={row.icon} />
          <span style={{ marginLeft: 5 }}>{value}</span>
        </span>
      ),
    },
    {
      title: "类型",
      dataIndex: "menuType",
      width: 100,
      render: (value, row) => {
        const [label, color] =
          (value === "M" || value === "C") && String(row.isFrame) === "0"
            ? ["外链", "error"]
            : { M: ["目录", "processing"], C: ["菜单", "success"], F: ["按钮", "warning"] }[
                value
              ] || [];
        return label ? (
          <Tag className="dict-tag menu-type-tag" color={color}>
            {label}
          </Tag>
        ) : null;
      },
    },
    {
      title: "排序",
      dataIndex: "orderNum",
      width: 200,
      render: (value, row) => (
        <InputNumber
          className="menu-sort-input"
          style={{ width: 88 }}
          min={0}
          precision={0}
          value={orders[row.menuId] ?? value}
          disabled={!checkPermi(["system:menu:edit"])}
          onChange={(value) => setOrders({ ...orders, [row.menuId]: value ?? 0 })}
        />
      ),
    },
    { title: "权限标识", dataIndex: "perms", ellipsis: true },
    { title: "组件路径", dataIndex: "component", ellipsis: true },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (value) => <DictTag options={sys_normal_disable} value={value} />,
    },
    {
      className: "ruoyi-actions-cell",
      align: "center",
      title: "操作",
      width: 210,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={["system:menu:edit"]}>
            <TableAction symbol="Edit" onClick={() => handleUpdate(row)}>
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={["system:menu:add"]}>
            <TableAction symbol="Plus" onClick={() => handleAdd(row)}>
              新增
            </TableAction>
          </HasPermi>
          <HasPermi value={["system:menu:remove"]}>
            <TableAction symbol="Delete" onClick={() => handleDelete(row)}>
              删除
            </TableAction>
          </HasPermi>
        </TableActions>
      ),
    },
  ];
  return (
    <div className="app-container">
      {showSearch && (
        <Form form={queryRef} className="search-form" layout="inline" onFinish={setQuery}>
          <Form.Item name="menuName" label="菜单名称">
            <Input style={{ width: 200 }} placeholder="请输入菜单名称" allowClear />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              style={{ width: 200 }}
              placeholder="菜单状态"
              allowClear
              options={sys_normal_disable}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button icon={<SearchOutlined />} htmlType="submit" type="primary">
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields();
                  setQuery({});
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={["system:menu:add"]}>
          <Button
            icon={<PlusOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            onClick={() => handleAdd()}
          >
            新增
          </Button>
        </HasPermi>
        <HasPermi value={["system:menu:edit"]}>
          <Button
            icon={<CheckOutlined />}
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            onClick={handleSaveSort}
          >
            保存排序
          </Button>
        </HasPermi>
        <Button
          className="ruoyi-plain-button ruoyi-plain-button--info"
          type="default"
          onClick={() => setExpanded(expanded.length ? [] : rows.map((row) => row.menuId))}
        >
          展开 / 折叠
        </Button>
        <RightToolbar showSearch={showSearch} onShowSearch={setShowSearch} onQuery={getList} />
      </div>
      <Table
        className="menu-table"
        size="small"
        rowKey="menuId"
        dataSource={handleTree(
          rows.map((row) => ({ ...row })),
          "menuId",
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
                aria-label={`${expanded ? "收起" : "展开"}${record.menuName}`}
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
        title={menuId !== undefined ? "修改菜单" : "添加菜单"}
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
          wrapperCol={{ flex: "1 1 0" }}
          labelCol={{ flex: "100px" }}
          form={menuRef}
          layout="horizontal"
        >
          <Row gutter={20}>
            <Col xs={24} sm={24}>
              <Form.Item label="上级菜单" name="parentId">
                <TreeSelect
                  placeholder="选择上级菜单"
                  fieldNames={{
                    value: "menuId",
                    label: "menuName",
                    children: "children",
                  }}
                  treeData={menuOptions}
                  treeDefaultExpandAll
                  showSearch
                  treeNodeFilterProp="menuName"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24}>
              <Form.Item name="menuType" label="菜单类型">
                <Radio.Group
                  options={[
                    { value: "M", label: "目录" },
                    { value: "C", label: "菜单" },
                    { value: "F", label: "按钮" },
                  ]}
                />
              </Form.Item>
            </Col>
            {menuType !== "F" && (
              <Col xs={24} sm={12}>
                <Form.Item name="icon" label="菜单图标">
                  <IconSelect placeholder="点击选择图标" />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} sm={12}>
              <Form.Item name="orderNum" label="显示排序" rules={[{ required: true }]}>
                <InputNumber min={0} precision={0} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="menuName" label="菜单名称" rules={[{ required: true }]}>
                <Input placeholder="请输入菜单名称" />
              </Form.Item>
            </Col>
            {menuType === "C" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="routeName"
                  label={
                    <FormLabel
                      label="路由名称"
                      help="默认不填则和路由地址相同：如地址为：`user`，则名称为`User`（注意：因为router会删除名称相同路由，为避免名字的冲突，特殊情况下请自定义，保证唯一性）"
                    />
                  }
                >
                  <Input placeholder="请输入路由名称" />
                </Form.Item>
              </Col>
            )}
            {menuType !== "F" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="isFrame"
                  label={
                    <FormLabel label="是否外链" help="选择是外链则路由地址需要以`http(s)://`开头" />
                  }
                >
                  <Radio.Group
                    options={[
                      { value: 0, label: "是" },
                      { value: 1, label: "否" },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}
            {menuType !== "F" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="path"
                  label={
                    <FormLabel
                      label="路由地址"
                      help="访问的路由地址，如：`user`，如外网地址需内链访问则以`http(s)://`开头"
                    />
                  }
                  rules={[{ required: true }]}
                >
                  <Input placeholder="请输入路由地址" />
                </Form.Item>
              </Col>
            )}
            {menuType === "C" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="component"
                  label={
                    <FormLabel
                      label="组件路径"
                      help="访问的组件路径，如：`system/user/index`，默认在`views`目录下"
                    />
                  }
                >
                  <Input placeholder="请输入组件路径" />
                </Form.Item>
              </Col>
            )}
            {menuType !== "M" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="perms"
                  label={
                    <FormLabel
                      label="权限字符"
                      help="控制器中定义的权限字符，如：UserInterfaceAuthDependency('system:user:list')"
                    />
                  }
                >
                  <Input placeholder="请输入权限标识" maxLength={100} />
                </Form.Item>
              </Col>
            )}
            {menuType === "C" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="query"
                  label={
                    <FormLabel
                      label="路由参数"
                      help={'访问路由的默认传递参数，如：`{"id": 1, "name": "ry"}`'}
                    />
                  }
                >
                  <Input placeholder="请输入路由参数" maxLength={255} />
                </Form.Item>
              </Col>
            )}
            {menuType === "C" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="isCache"
                  label={
                    <FormLabel
                      label="是否缓存"
                      help="选择缓存则切换页面时保留页面状态；选择不缓存则重新加载页面。"
                    />
                  }
                >
                  <Radio.Group
                    options={[
                      { value: 0, label: "缓存" },
                      { value: 1, label: "不缓存" },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}
            {menuType !== "F" && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="visible"
                  label={
                    <FormLabel
                      label="显示状态"
                      help="选择隐藏则路由将不会出现在侧边栏，但仍然可以访问"
                    />
                  }
                >
                  <Radio.Group options={sys_show_hide} />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} sm={12}>
              <Form.Item
                name="status"
                label={
                  <FormLabel
                    label="菜单状态"
                    help="选择停用则路由将不会出现在侧边栏，也不能被访问"
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
  );
}
