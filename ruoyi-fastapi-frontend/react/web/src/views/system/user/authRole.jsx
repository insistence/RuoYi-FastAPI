import Pagination from "@/components/Pagination";
import { useEffect, useState } from "react";
import { Button, Form, Input, Row, Col, Space, Tag } from "antd";
import Table from "@/components/Table";
import { useNavigate } from "react-router-dom";
import { getAuthRole, updateAuthRole } from "@/api/system/user";
import { message } from "@/plugins/modal";
import { parseTime } from "@/utils/ruoyi";
export default function AuthRole({ params }) {
  const [user, setUser] = useState({}),
    [roles, setRoles] = useState([]),
    [roleIds, setRoleIds] = useState([]),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [page,setPage] = useState({pageNum:1,pageSize:10});
  useEffect(() => {
    setLoading(true);
    getAuthRole(params.userId)
      .then((result) => {
        setUser(result.user);
        setRoles(result.roles);
        setRoleIds(result.roles.filter((row) => row.flag).map((row) => row.roleId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.userId]);
  async function submitForm() {
    setSaving(true);
    try {
      await updateAuthRole({ userId: user.userId, roleIds: roleIds.join(",") });
      message.success("授权成功");
      navigate("/system/user");
    } catch {
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="app-container">
      <h4 className="form-header h4">基本信息</h4>
      <Form colon={false} labelCol={{flex:"80px"}}><Row><Col span={8} offset={2}><Form.Item label="用户昵称"><Input disabled value={user.nickName} /></Form.Item></Col><Col span={8} offset={2}><Form.Item label="登录账号"><Input disabled value={user.userName} /></Form.Item></Col></Row></Form>
      <h4 className="form-header h4">角色信息</h4>
      <Table
        rowKey="roleId"
        loading={loading}
        dataSource={roles.slice((page.pageNum-1)*page.pageSize,page.pageNum*page.pageSize)}
        pagination={false}
        onRow={row=>({onClick:event=>{if(row.status === "0" && !event.target.closest(".ant-checkbox-wrapper"))setRoleIds(ids=>ids.includes(row.roleId)?ids.filter(id=>id!==row.roleId):[...ids,row.roleId]);}})}
        rowSelection={{
          selectedRowKeys: roleIds,
          onChange: setRoleIds,
          preserveSelectedRowKeys: true,
          getCheckboxProps: (row) => ({ disabled: row.status !== "0" }),
        }}
        columns={[
          {title:"序号",width:55,align:"center",render:(_,row,index)=>(page.pageNum-1)*page.pageSize+index+1},
          Table.SELECTION_COLUMN,
          { align: "center", title: "角色编号", dataIndex: "roleId" },
          { align: "center", title: "角色名称", dataIndex: "roleName" },
          { align: "center", title: "权限字符", dataIndex: "roleKey" },
          { width: 180,
            align: "center",
            title: "创建时间",
            dataIndex: "createTime",
            render: (value) => parseTime(value),
          },

        ]}
      />
      <Pagination total={roles.length} page={page.pageNum} limit={page.pageSize} onChange={setPage} />
      <div style={{textAlign:"center",marginLeft:-120,marginTop:30}}><Space>
        <Button type="primary" onClick={submitForm} loading={saving}>
          提交
        </Button>
        <Button onClick={() => navigate("/system/user")}>返回</Button>
      </Space></div>
    </div>
  );
}
