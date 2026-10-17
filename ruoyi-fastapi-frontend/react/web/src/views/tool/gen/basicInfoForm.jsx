import { Col, Form, Input, Row } from 'antd'
export default function BasicInfoForm() {
  return (
    <Row>
      {[
        ['tableName', '表名称', '请输入仓库名称'],
        ['tableComment', '表描述', '请输入'],
        ['className', '实体类名称', '请输入'],
        ['functionAuthor', '作者', '请输入'],
      ].map(([name, label, placeholder]) => (
        <Col
          xs={24}
          md={12}
          key={name}
        >
          <Form.Item
            name={name}
            label={label}
            rules={[{ required: true, message: `请输入${label}` }]}
          >
            <Input placeholder={placeholder} />
          </Form.Item>
        </Col>
      ))}
      <Col span={24}>
        <Form.Item
          name="remark"
          label="备注"
        >
          <Input.TextArea
            rows={3}
            placeholder="请输入内容"
          />
        </Form.Item>
      </Col>
    </Row>
  )
}
