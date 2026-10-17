import { useEffect, useState } from "react";
import { Alert, Drawer } from "antd";
import FileTag from "./FileTag";
import Table from "@/components/Table";
import { listFileReference } from "@/api/system/file";
import { parseTime } from "@/utils/ruoyi";

export default function FileReferenceDrawer({ file, onClose }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!file) return;
    let active = true;
    setLoading(true);
    listFileReference(file.fileId)
      .then((result) => {
        if (active) setRows(result.data || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [file]);
  return (
    <Drawer
      rootClassName="file-drawer"
      title={`业务引用 - ${file?.originalName || ""}`}
      open={!!file}
      onClose={onClose}
      size="55%"
    >
      <Alert
        title="存在业务引用时文件不能移入回收站，请先在对应业务中解除文件引用。"
        type="warning"
        showIcon
        style={{ marginBottom: 8 }}
      />
      <Table
        rowKey={(row, index) => row.referenceId || `${row.businessType}-${row.businessId}-${index}`}
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1040 }}
        columns={[
          { width: 130, align: "center", title: "业务类型", dataIndex: "businessType" },
          { width: 180, title: "业务名称", dataIndex: "businessName" },
          { width: 160, align: "center", title: "业务ID", dataIndex: "businessId" },
          {
            align: "center",
            title: "保留到期",
            dataIndex: "retentionExpireTime",
            width: 180,
            render: (value) => (value ? parseTime(value) : "永久保留"),
          },
          {
            width: 100,
            align: "center",
            title: "来源",
            dataIndex: "legacy",
            render: (value) => (
              <FileTag type={value ? "info" : "success"} effect="plain">
                {value ? "兼容字段" : "引用关系"}
              </FileTag>
            ),
          },
          { width: 110, align: "center", title: "登记人", dataIndex: "createBy" },
          {
            align: "center",
            title: "登记时间",
            dataIndex: "createTime",
            width: 180,
            render: (value) => parseTime(value),
          },
        ]}
      />
    </Drawer>
  );
}
