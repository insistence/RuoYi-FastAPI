import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Form, Input, Select, Space, TreeSelect } from "antd";
import { BusinessDateTimeRangePicker } from "@/components/BusinessDateTimePicker";
import { serializeTimeFieldsForSubmit } from "@/utils/time";

export default function FileSearchForm({ show, deptOptions, onQuery }) {
  const [form] = Form.useForm();
  async function search({ dateRange, ...values }) {
    values.beginTime = dateRange?.[0]; values.endTime = dateRange?.[1];
    const data = await serializeTimeFieldsForSubmit(values, ["beginTime", "endTime"]);
    if (data) onQuery(data);
  }
  return (
    <Form
      style={{ display: show ? undefined : "none" }}
      form={form}
      initialValues={{ status: "active" }}
      layout="inline"
      className="search-form file-search-form"
      colon={false}
      labelCol={{flex:"68px"}}
      onFinish={search}
    >
      <Form.Item name="originalName" label="文件名称"><Input placeholder="请输入原始文件名" allowClear /></Form.Item>
      <Form.Item name="accessType" label="访问类型">
        <Select style={{ width: 200 }}
          placeholder="请选择访问类型"
          allowClear
          options={[
            { value: "public", label: "公开文件" },
            { value: "private", label: "受保护文件" },
          ]}
        />
      </Form.Item>
      <Form.Item name="status" label="文件状态">
        <Select style={{ width: 200 }}
          placeholder="请选择文件状态"
          allowClear
          options={[
            { value: "active", label: "正常" },
            { value: "deleted", label: "已删除" },
            { value: "purging", label: "清理中" },
          ]}
        />
      </Form.Item>
      <Form.Item name="createBy" label="上传用户"><Input placeholder="请输入上传用户" allowClear /></Form.Item>
      <Form.Item name="ownerName" label="所有者"><Input placeholder="请输入所有者" allowClear /></Form.Item>
      <Form.Item name="deptId" label="所属部门">
        <TreeSelect
          placeholder="请选择所属部门"
          allowClear
          showSearch
          treeNodeFilterProp="label"
          fieldNames={{ label: "label", value: "id", children: "children" }}
          treeData={deptOptions}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item name="expirationStatus" label="过期状态">
        <Select style={{ width: 200 }}
          placeholder="请选择过期状态"
          allowClear
          options={[
            ["permanent", "永久有效"],
            ["valid", "有效"],
            ["expiring", "7天内过期"],
            ["expired", "已过期"],
          ].map(([value, label]) => ({ value, label }))}
        />
      </Form.Item>
      <Form.Item name="dateRange" label="上传时间"><BusinessDateTimeRangePicker separator="-" label="上传时间" style={{ width: 200 }} /></Form.Item>
      <Form.Item>
        <Space>
          <Button icon={<SearchOutlined />} type="primary" htmlType="submit">
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              form.resetFields();
              onQuery({ status: "active" });
            }}
          >
            重置
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
