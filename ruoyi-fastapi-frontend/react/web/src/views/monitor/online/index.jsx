import { TableAction } from "@/components/TableActions";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, Space } from "antd";
import Table from "@/components/Table";
import { list, forceLogout } from "@/api/monitor/online";
import { parseTime } from "@/utils/ruoyi";
import { confirm, message } from "@/plugins/modal";
import HasPermi from "@/directive/permission/hasPermi";
import Pagination from "@/components/Pagination";

export default function Online() {
  const [form] = Form.useForm();
  const [query, setQuery] = useState({}),
    [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false);
  const [page, setPage] = useState({ pageNum: 1, pageSize: 10 });
  const getList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await list(query);
      setRows(result.rows || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void getList();
  }, [getList]);
  function search(values) {
    setQuery(values);
    setPage({ ...page, pageNum: 1 });
  }
  async function logout(row) {
    try {
      await confirm(`是否确认强退名称为“${row.userName}”的用户？`);
      await forceLogout(row.tokenId);
      message.success("强退成功");
      await getList();
    } catch {}
  }
  const columns = [
    {
      align: "center",
      title: "序号",
      width: 50,
      render: (_, row, index) => (page.pageNum - 1) * page.pageSize + index + 1,
    },
    ...[
      ["tokenId", "会话编号"],
      ["userName", "登录名称"],
      ["deptName", "所属部门"],
      ["ipaddr", "主机"],
      ["loginLocation", "登录地点"],
      ["os", "操作系统"],
      ["browser", "浏览器"],
    ].map(([dataIndex, title]) => ({ align: "center", title, dataIndex, ellipsis: true })),
    {
      align: "center",
      title: "登录时间",
      dataIndex: "loginTime",
      width: 180,
      render: (value) => parseTime(value),
    },
    {
      className: "ruoyi-actions-cell",
      align: "center",
      title: "操作",
      width: 80,
      render: (_, row) => (
        <HasPermi value={["monitor:online:forceLogout"]}>
          <TableAction symbol="Delete" onClick={() => logout(row)}>
            强退
          </TableAction>
        </HasPermi>
      ),
    },
  ];
  return (
    <div className="app-container">
      <Form form={form} layout="inline" className="search-form" onFinish={search}>
        <Form.Item label="登录地址" name="ipaddr">
          <Input style={{ width: 200 }} placeholder="请输入登录地址" allowClear />
        </Form.Item>
        <Form.Item label="用户名称" name="userName">
          <Input style={{ width: 200 }} placeholder="请输入用户名称" allowClear />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button icon={<SearchOutlined />} type="primary" htmlType="submit">
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                form.resetFields();
                search({});
              }}
            >
              重置
            </Button>
            <Button onClick={getList}>刷新</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table
        loading={loading}
        rowKey="tokenId"
        dataSource={rows.slice((page.pageNum - 1) * page.pageSize, page.pageNum * page.pageSize)}
        columns={columns}
        pagination={false}
        scroll={{ x: 1200 }}
      />
      <Pagination
        total={rows.length}
        page={page.pageNum}
        limit={page.pageSize}
        onChange={setPage}
      />
    </div>
  );
}
