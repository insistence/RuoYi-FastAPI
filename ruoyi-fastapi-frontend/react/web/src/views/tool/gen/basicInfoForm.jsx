import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { Col, Form, Input, Row } from 'antd'
export default function BasicInfoForm() {
  useI18n()

  return (
    <Row>
      {[
        ['tableName', t('tool:gen.tableName'), t('tool:enterRepositoryName')],
        ['tableComment', t('tool:gen.tableComment'), t('tool:enterAValue')],
        ['className', t('tool:entityClassName'), t('tool:enterAValue')],
        ['functionAuthor', t('system:author'), t('tool:enterAValue')],
      ].map(([name, label, placeholder]) => (
        <Col
          xs={24}
          md={12}
          key={name}
        >
          <Form.Item
            name={name}
            label={label}
            rules={[{ required: true, message: t('monitor:enterValue', { label }) }]}
          >
            <Input placeholder={placeholder} />
          </Form.Item>
        </Col>
      ))}
      <Col span={24}>
        <Form.Item
          name="remark"
          label={t('common:remark')}
        >
          <Input.TextArea
            rows={3}
            placeholder={t('common:contentPlaceholder')}
          />
        </Form.Item>
      </Col>
    </Row>
  )
}
