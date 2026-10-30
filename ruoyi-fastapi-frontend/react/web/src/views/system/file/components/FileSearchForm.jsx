import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { t } from '@/i18n'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Form, Input, Select, Space, TreeSelect } from 'antd'
import { BusinessDateTimeRangePicker } from '@/components/BusinessDateTimePicker'
import { serializeTimeFieldsForSubmit } from '@/utils/time'

export default function FileSearchForm({ show, deptOptions, onQuery }) {
  useI18n()

  const [form] = Form.useForm()
  useLocalizedFormErrors(form)
  async function search({ dateRange, ...values }) {
    values.beginTime = dateRange?.[0]
    values.endTime = dateRange?.[1]
    const data = await serializeTimeFieldsForSubmit(values, ['beginTime', 'endTime'])
    if (data) onQuery(data)
  }
  return (
    <Form
      style={{ display: show ? undefined : 'none' }}
      form={form}
      initialValues={{ status: 'active' }}
      layout="inline"
      className="search-form file-search-form"
      colon={false}
      labelCol={{ flex: '68px' }}
      onFinish={search}
    >
      <Form.Item
        name="originalName"
        label={t('file:name')}
      >
        <Input
          placeholder={t('system:enterTheOriginalFileName')}
          allowClear
        />
      </Form.Item>
      <Form.Item
        name="accessType"
        label={t('file:accessType')}
      >
        <Select
          style={{ width: 200 }}
          placeholder={t('system:selectAnAccessType')}
          allowClear
          options={[
            { value: 'public', label: t('system:publicFiles') },
            { value: 'private', label: t('system:protectedFiles') },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="status"
        label={t('system:fileStatus')}
      >
        <Select
          style={{ width: 200 }}
          placeholder={t('system:selectAFileStatus')}
          allowClear
          options={[
            { value: 'active', label: t('layout:notices.active') },
            { value: 'deleted', label: t('system:deleted') },
            { value: 'purging', label: t('system:deleting') },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="createBy"
        label={t('system:uploader')}
      >
        <Input
          placeholder={t('system:enterAnUploader')}
          allowClear
        />
      </Form.Item>
      <Form.Item
        name="ownerName"
        label={t('file:owner')}
      >
        <Input
          placeholder={t('system:enterAnOwner')}
          allowClear
        />
      </Form.Item>
      <Form.Item
        name="deptId"
        label={t('system:user.department')}
      >
        <TreeSelect
          placeholder={t('system:components.selectADepartment')}
          allowClear
          showSearch
          treeNodeFilterProp="label"
          fieldNames={{ label: 'label', value: 'id', children: 'children' }}
          treeData={deptOptions}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item
        name="expirationStatus"
        label={t('system:expiryStatus')}
      >
        <Select
          style={{ width: 200 }}
          placeholder={t('system:selectAnExpiryStatus')}
          allowClear
          options={[
            ['permanent', t('system:noExpiry')],
            ['valid', t('system:valid')],
            ['expiring', t('system:expiresWithin7Days')],
            ['expired', t('common:expired')],
          ].map(([value, label]) => ({ value, label }))}
        />
      </Form.Item>
      <Form.Item
        name="dateRange"
        label={t('system:uploadedAt')}
      >
        <BusinessDateTimeRangePicker
          separator="-"
          label={t('system:uploadedAt')}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button
            icon={<SearchOutlined />}
            type="primary"
            htmlType="submit"
          >
            {t('common:search')}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              form.resetFields()
              onQuery({ status: 'active' })
            }}
          >
            {t('common:reset')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
