import TableActions, { TableAction } from "@/components/TableActions";
import { renderDialogFooter } from "@/components/DialogFooter";
import { ReloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Radio, Select, Space } from "antd";
import Table from "@/components/Table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { listPost, addPost, delPost, getPost, updatePost } from "@/api/system/post";
import { useDict } from "@/utils/dict";
import { parseTime } from "@/utils/ruoyi";
import { download } from "@/utils/request";
import { message, confirm } from "@/plugins/modal";
import HasPermi from "@/directive/permission/hasPermi";
import DictTag from "@/components/DictTag";
import Pagination from "@/components/Pagination";
import RightToolbar from "@/components/RightToolbar";

export default function Post() {
  const { sys_normal_disable } = useDict("sys_normal_disable");
  const [queryRef] = Form.useForm(),
    [postRef] = Form.useForm();
  const [postList, setPostList] = useState([]),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(true),
    [ids, setIds] = useState([]);
  const [queryParams, setQueryParams] = useState({ pageNum: 1, pageSize: 10 });
  const [open, setOpen] = useState(false),
    [postId, setPostId] = useState();
  const getList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listPost(queryParams);
      setPostList(response.rows);
      setTotal(response.total);
      setIds([]);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [queryParams]);
  useEffect(() => {
    void getList();
  }, [getList]);
  function handleQuery(values) {
    setQueryParams({ ...values, pageNum: 1, pageSize: queryParams.pageSize });
  }
  function handleAdd() {
    setPostId(undefined);
    postRef.resetFields();
    postRef.setFieldsValue({ postSort: 0, status: "0" });
    setOpen(true);
  }
  async function handleUpdate(id) {
    try {
      const result = await getPost(id);
      setPostId(id);
      postRef.resetFields();
      postRef.setFieldsValue(result.data);
      setOpen(true);
    } catch {}
  }
  async function handleDelete(values) {
    try {
      await confirm(`是否确认删除岗位编号为“${values}”的数据项？`);
      await delPost(values);
      message.success("删除成功");
      await getList();
    } catch {}
  }
  async function submitForm() {
    try {
      const values = await postRef.validateFields();
      setSaving(true);
      await (postId !== undefined ? updatePost({ ...values, postId }) : addPost(values));
      message.success(postId !== undefined ? "修改成功" : "新增成功");
      setOpen(false);
      await getList();
    } catch {
    } finally {
      setSaving(false);
    }
  }
  const columns = [
    { align: "center", title: "岗位编号", dataIndex: "postId" },
    { align: "center", title: "岗位编码", dataIndex: "postCode" },
    { align: "center", title: "岗位名称", dataIndex: "postName" },
    { align: "center", title: "岗位排序", dataIndex: "postSort" },
    {
      align: "center",
      title: "状态",
      dataIndex: "status",
      render: (value) => <DictTag options={sys_normal_disable} value={value} />,
    },
    {
      align: "center",
      title: "创建时间",
      dataIndex: "createTime",
      render: (value) => parseTime(value),
      width: 180,
    },
    {
      className: "ruoyi-actions-cell",
      align: "center",
      title: "操作",
      key: "action",
      width: 180,
      render: (_, row) => (
        <TableActions>
          <HasPermi value={["system:post:edit"]}>
            <TableAction symbol="Edit" onClick={() => handleUpdate(row.postId)}>
              修改
            </TableAction>
          </HasPermi>
          <HasPermi value={["system:post:remove"]}>
            <TableAction symbol="Delete" onClick={() => handleDelete([row.postId])}>
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
        <Form form={queryRef} layout="inline" className="search-form" onFinish={handleQuery}>
          <Form.Item label="岗位编码" name="postCode">
            <Input style={{ width: 200 }} placeholder="请输入岗位编码" allowClear />
          </Form.Item>
          <Form.Item label="岗位名称" name="postName">
            <Input style={{ width: 200 }} placeholder="请输入岗位名称" allowClear />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Select style={{ width: 200 }} placeholder="岗位状态" allowClear options={sys_normal_disable} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryRef.resetFields();
                  handleQuery({});
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
      <div className="table-toolbar">
        <HasPermi value={["system:post:add"]}>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--primary"
            type="default"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增
          </Button>
        </HasPermi>
        <HasPermi value={["system:post:edit"]}>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--success"
            type="default"
            icon={<EditOutlined />}
            disabled={ids.length !== 1}
            onClick={() => handleUpdate(ids[0])}
          >
            修改
          </Button>
        </HasPermi>
        <HasPermi value={["system:post:remove"]}>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--danger"
            type="default"
            icon={<DeleteOutlined />}
            disabled={!ids.length}
            onClick={() => handleDelete(ids)}
          >
            删除
          </Button>
        </HasPermi>
        <HasPermi value={["system:post:export"]}>
          <Button
            className="ruoyi-plain-button ruoyi-plain-button--warning"
            type="default"
            icon={<DownloadOutlined />}
            onClick={() =>
              download("/system/post/export", queryParams, `post_${Date.now()}.xlsx`).catch(
                () => {},
              )
            }
          >
            导出
          </Button>
        </HasPermi>
        <RightToolbar showSearch={showSearch} onShowSearch={setShowSearch} onQuery={getList} />
      </div>
      <Table
        rowKey="postId"
        loading={loading}
        dataSource={postList}
        columns={columns}
        pagination={false}
        scroll={{ x: 900 }}
        rowSelection={{ selectedRowKeys: ids, onChange: setIds }}
      />
      <Pagination
        total={total}
        page={queryParams.pageNum}
        limit={queryParams.pageSize}
        onChange={(page) => setQueryParams({ ...queryParams, ...page })}
      />
      <Modal
        footer={renderDialogFooter}
        width="500px"
        open={open}
        title={postId !== undefined ? "修改岗位" : "添加岗位"}
        onCancel={() => setOpen(false)}
        onOk={submitForm}
        confirmLoading={saving}
        forceRender
      >
        <Form
          name="src-views-system-post-index-jsx-editor-17"
          className="ruoyi-dialog-form"
          colon={false}
          wrapperCol={{ flex: "1 1 0" }}
          labelCol={{ flex: "80px" }}
          form={postRef}
          layout="horizontal"
        >
          <Form.Item
            label="岗位名称"
            name="postName"
            rules={[{ required: true, message: "岗位名称不能为空" }]}
          >
            <Input placeholder="请输入岗位名称" maxLength={50} />
          </Form.Item>
          <Form.Item
            label="岗位编码"
            name="postCode"
            rules={[{ required: true, message: "岗位编码不能为空" }]}
          >
            <Input placeholder="请输入编码名称" maxLength={64} />
          </Form.Item>
          <Form.Item
            label="岗位顺序"
            name="postSort"
            rules={[{ required: true, message: "岗位顺序不能为空" }]}
          >
            <InputNumber min={0} precision={0} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group options={sys_normal_disable} />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea placeholder="请输入内容" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
