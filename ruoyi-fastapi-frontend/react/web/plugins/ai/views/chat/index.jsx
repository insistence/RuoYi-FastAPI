import { useLocalizedFormErrors } from '@/i18n/form'
import { useI18n } from '@/i18n/adapter'
import { i18n, t } from '@/i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Col,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
} from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
} from '@ant-design/icons'
import SvgIcon from '@/components/SvgIcon'
import { listModelAll } from '../../api/model'
import {
  cancelChatRun,
  delChatSession,
  getChatSession,
  getUserChatConfig,
  listChatSession,
  saveUserChatConfig,
} from '../../api/chat'
import request from '@/utils/request'
import { getToken } from '@/utils/auth'
import { getDisplayTimezone } from '@/utils/time'
import { parseTime } from '@/utils/ruoyi'
import { confirm, message } from '@/plugins/modal'
import AiMessage from './components/AiMessage'
import ChatIcon from './components/ChatIcon'
import { readChatStream } from './stream'
import './style.css'

const defaults = {
  temperature: undefined,
  addHistoryToContext: '0',
  numHistoryRuns: 3,
  systemPrompt: '',
  metricsDefaultVisible: '1',
  visionEnabled: '0',
  imageMaxSizeMb: 5,
}
const imageUrl = (url) =>
  /^(https?:|blob:)/.test(url) ? url : import.meta.env.VITE_APP_BASE_API + url
const enabledField = {
  valuePropName: 'checked',
  getValueProps: (value) => ({ checked: value === '0' }),
  normalize: (value) => (value ? '0' : '1'),
}
export default function AiChat() {
  useI18n()

  const [models, setModels] = useState([]),
    [modelId, setModelId] = useState(),
    [messages, setMessages] = useState([]),
    [input, setInput] = useState(''),
    [images, setImages] = useState([]),
    [sending, setSending] = useState(false),
    [sessions, setSessions] = useState([]),
    [sessionLoading, setSessionLoading] = useState(false),
    [historyLoading, setHistoryLoading] = useState(false),
    [sessionId, setSessionId] = useState(() => crypto.randomUUID()),
    [agentData, setAgentData] = useState(),
    [config, setConfig] = useState(defaults),
    [configOpen, setConfigOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [temperature, setTemperature] = useState(),
    [reasoning, setReasoning] = useState(true),
    [uploading, setUploading] = useState(false),
    [form] = Form.useForm()
  useLocalizedFormErrors(form)
  const includeHistory = Form.useWatch('addHistoryToContext', form)
  const active = useRef(true),
    stream = useRef(),
    historyRequest = useRef(0),
    imageInput = useRef(),
    history = useRef(),
    content = useRef(),
    autoScroll = useRef(true)
  const model = models.find((item) => item.modelId === modelId),
    vision = model?.supportImages === 'Y' && config.visionEnabled === '0'
  const loadSessions = useCallback(async () => {
    setSessionLoading(true)
    try {
      const result = await listChatSession()
      if (active.current)
        setSessions(
          (result.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        )
    } catch {
    } finally {
      if (active.current) setSessionLoading(false)
    }
  }, [])
  async function stop() {
    const current = stream.current
    if (!current) return
    stream.current = undefined
    if (active.current) setSending(false)
    try {
      if (current.runId) await cancelChatRun(current.runId)
    } catch {
    } finally {
      current.controller.abort()
      if (active.current) loadSessions()
    }
  }
  useEffect(() => {
    active.current = true
    listModelAll()
      .then((result) => {
        if (!active.current) return
        const values = result.data || []
        setModels(values)
        if (values.length) {
          setModelId(values[0].modelId)
          setTemperature(values[0].temperature)
        }
      })
      .catch(() => {})
    getUserChatConfig()
      .then((result) => {
        if (active.current && result.data) setConfig({ ...defaults, ...result.data })
      })
      .catch(() => {})
    loadSessions()
    return () => {
      active.current = false
      historyRequest.current++
      void stop()
    }
  }, [loadSessions])
  useEffect(() => {
    if (autoScroll.current && history.current)
      history.current.scrollTop = history.current.scrollHeight
  }, [messages])
  useEffect(() => {
    if (!content.current) return
    const observer = new ResizeObserver(() => {
      if (autoScroll.current && history.current)
        history.current.scrollTop = history.current.scrollHeight
    })
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [])
  async function newChat() {
    await stop()
    historyRequest.current++
    setSessionId(crypto.randomUUID())
    setMessages([])
    setAgentData(undefined)
    setImages([])
    setHistoryLoading(false)
    autoScroll.current = true
  }
  async function loadSession(id) {
    if (id === sessionId) return
    await stop()
    const version = ++historyRequest.current
    setSessionId(id)
    setMessages([])
    setAgentData(undefined)
    setHistoryLoading(true)
    autoScroll.current = true
    try {
      const result = await getChatSession(id)
      if (active.current && version === historyRequest.current) {
        setMessages(
          (result.data.messages || []).map((item) => ({
            ...item,
            id: crypto.randomUUID(),
          }))
        )
        setAgentData(result.data.agentData)
      }
    } catch {
    } finally {
      if (active.current && version === historyRequest.current) setHistoryLoading(false)
    }
  }
  async function deleteSession(id) {
    try {
      await confirm(t('plugin.ai:deleteThisConversation'))
      if (id === sessionId) await stop()
      await delChatSession(id)
      if (id === sessionId) await newChat()
      message.success(t('plugin.ai:deletedSuccessfully'))
      loadSessions()
    } catch {}
  }
  async function send() {
    const localeHeaders = i18n.headers
    const t = i18n.engine.getFixedT(i18n.locale)
    const text = input.trim(),
      imageList = vision ? [...images] : []
    if (sending || uploading || historyLoading || (!text && !imageList.length)) return
    if (!modelId) return message.error(t('plugin.ai:chooseAModelFirst'))
    const id = crypto.randomUUID(),
      controller = new AbortController(),
      current = { controller, runId: null }
    stream.current = current
    setSending(true)
    setInput('')
    setImages([])
    autoScroll.current = true
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        images: imageList,
      },
      {
        id,
        role: 'assistant',
        content: '',
        reasoningContent: '',
        streaming: true,
      },
    ])
    let fullText = '',
      fullReasoning = ''
    const update = (patch) => {
      if (active.current && stream.current === current)
        setMessages((previous) =>
          previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
        )
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_APP_BASE_API}/ai/chat/send`, {
        method: 'POST',
        headers: {
          ...localeHeaders,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
          'X-Timezone': getDisplayTimezone(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          modelId,
          message: text,
          images: imageList,
          sessionId,
          stream: true,
          temperature,
          isReasoning: reasoning,
        }),
      })
      if (!response.ok) {
        let body
        try {
          body = await response.json()
        } catch {}
        throw new Error(
          body?.msg ||
            body?.detail ||
            t('plugin.ai:requestFailedValue', { status: response.status })
        )
      }
      await readChatStream(
        response.body,
        (event) => {
          if (stream.current !== current) return
          switch (event.type) {
            case 'content':
              fullText += event.content || ''
              update({ content: fullText })
              break
            case 'reasoning':
              fullReasoning += event.content || ''
              update({ reasoningContent: fullReasoning })
              break
            case 'meta':
              if (event.session_id) setSessionId(event.session_id)
              break
            case 'run_info':
              current.runId = event.run_id
              break
            case 'metrics':
              update({ metrics: event.metrics })
              break
            case 'error':
              throw new Error(event.error || t('plugin.ai:generationFailed'))
            default:
              if (event.code && event.code !== 200)
                throw new Error(event.msg || t('plugin.ai:requestFailed'))
          }
        },
        controller.signal,
        t
      )
    } catch (error) {
      if (error.name !== 'AbortError' && stream.current === current) {
        update({ error: error.message })
        message.error(error.message)
      }
    } finally {
      if (active.current)
        setMessages((previous) =>
          previous.map((item) => (item.id === id ? { ...item, streaming: false } : item))
        )
      if (stream.current === current) {
        stream.current = undefined
        if (active.current) {
          setSending(false)
          loadSessions()
        }
      }
    }
  }
  async function upload(fileList) {
    if (!vision || sending) return
    const files = Array.from(fileList || [])
    if (!files.length) return
    if (files.length + images.length > 10)
      return message.error(t('plugin.ai:youCanUploadUpTo10Images'))
    const limit = config.imageMaxSizeMb || 5
    if (files.some((file) => !file.type.startsWith('image/')))
      return message.error(t('plugin.ai:chooseImageFiles'))
    if (files.some((file) => file.size > limit * 1024 * 1024))
      return message.error(t('plugin.ai:eachImageMustBeNoLargerThanValueMb', { limit }))
    setUploading(true)
    try {
      for (const file of files) {
        const body = new FormData()
        body.append('file', file)
        const result = await request({
          url: '/common/upload',
          method: 'post',
          data: body,
          headers: { repeatSubmit: false },
        })
        if (!result.fileName) throw new Error(t('plugin.ai:theServerDidNotReturnAnImageUrl'))
        if (active.current) setImages((previous) => [...previous, result.fileName])
      }
    } catch (error) {
      if (error.message) message.error(error.message)
    } finally {
      if (active.current) setUploading(false)
      if (imageInput.current) imageInput.current.value = ''
    }
  }
  function openConfig() {
    form.resetFields()
    form.setFieldsValue(config)
    setConfigOpen(true)
  }
  async function saveConfig() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await saveUserChatConfig({
        ...values,
        ...(config.chatConfigId ? { chatConfigId: config.chatConfigId } : {}),
      })
      const result = await getUserChatConfig()
      setConfig({ ...defaults, ...result.data })
      message.success(t('plugin.ai:settingsSaved'))
      setConfigOpen(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="app-container ai-chat">
      <aside className="chat-session-sidebar">
        <div className="chat-sidebar-header">
          <Button
            type="primary"
            block
            icon={<PlusOutlined />}
            onClick={newChat}
          >
            {t('plugin.ai:newConversation')}
          </Button>
        </div>
        <div className="chat-session-list">
          <Spin spinning={sessionLoading}>
            <nav
              aria-label={t('plugin.ai:conversationHistory')}
              className="chat-sessions"
            >
              {sessions.map((session) => (
                <div
                  className={`chat-session ${sessionId === session.sessionId ? 'active' : ''}`}
                  key={session.sessionId}
                >
                  <button
                    className="chat-session-select"
                    onClick={() => loadSession(session.sessionId)}
                    aria-current={sessionId === session.sessionId ? 'true' : undefined}
                  >
                    <ChatIcon
                      kind="session"
                      className="chat-session-icon"
                    />
                    <span className="chat-session-info">
                      <span className="chat-session-title">
                        {session.sessionTitle || t('plugin.ai:chat.newConversation')}
                      </span>
                      <span className="chat-session-time">{parseTime(session.createdAt)}</span>
                    </span>
                  </button>
                  <Button
                    className="chat-session-delete"
                    type="text"
                    danger
                    aria-label={t('plugin.ai:deleteConversationValue', {
                      arg0: session.sessionTitle || t('plugin.ai:chat.newConversation'),
                    })}
                    icon={<DeleteOutlined />}
                    onClick={() => deleteSession(session.sessionId)}
                  />
                </div>
              ))}
              {!sessions.length && !sessionLoading && (
                <div className="chat-empty-session">{t('plugin.ai:noConversationHistory')}</div>
              )}
            </nav>
          </Spin>
        </div>
      </aside>
      <main className="chat-main">
        <header className="chat-header">
          <span className="chat-header-title">{t('plugin.ai:aiAssistant')}</span>
          <div className="chat-header-actions">
            <Tooltip
              title={t('plugin.ai:globalSettings')}
              placement="bottom"
            >
              <Button
                shape="circle"
                aria-label={t('plugin.ai:globalSettings')}
                icon={<SettingOutlined />}
                onClick={openConfig}
              />
            </Tooltip>
            <Select
              aria-label={t('plugin.ai:chooseAModel')}
              placeholder={t('plugin.ai:chooseAModel')}
              size="large"
              className="chat-model-select"
              value={modelId}
              disabled={sending}
              options={models.map((item) => ({
                value: item.modelId,
                label: `${item.provider}/${item.modelCode}`,
              }))}
              onChange={(value) => {
                setModelId(value)
                setTemperature(models.find((item) => item.modelId === value)?.temperature)
                setImages([])
              }}
            />
          </div>
        </header>
        <div
          className="chat-history"
          ref={history}
          onScroll={(event) => {
            const element = event.currentTarget
            autoScroll.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 100
          }}
        >
          <div
            ref={content}
            className={`chat-content${!messages.length ? ' is-empty' : ''}`}
          >
            <Spin spinning={historyLoading}>
              {!messages.length && !historyLoading && (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">
                    <ChatIcon />
                  </div>
                  <h2>{t('plugin.ai:helloIAmYourAiAssistant')}</h2>
                  <p>
                    {models.length
                      ? t('plugin.ai:enterAQuestionBelowToStartAConversation')
                      : t('plugin.ai:noModelsAvailableConfigureAModelInModelManagement')}
                  </p>
                </div>
              )}
              {messages.map((item) => (
                <article
                  key={item.id}
                  className={`chat-message-row ${item.role === 'user' ? 'chat-message-user' : 'chat-message-ai'}`}
                >
                  <Avatar
                    className="chat-message-avatar"
                    size={40}
                    icon={item.role === 'user' ? <ChatIcon kind="user" /> : <ChatIcon />}
                  />
                  <div className="chat-message-wrapper">
                    <div className="chat-message-sender">
                      {item.role === 'user' ? t('plugin.ai:me') : t('plugin.ai:chat.aiAssistant')}
                      {item.createdAt && (
                        <span className="chat-message-time">{parseTime(item.createdAt)}</span>
                      )}
                    </div>
                    <div className="chat-message-bubble">
                      {item.role === 'user' ? (
                        <>
                          {!!item.images?.length && (
                            <div className="chat-user-images">
                              <Image.PreviewGroup>
                                {item.images.map((url, index) => (
                                  <Image
                                    key={`${url}-${index}`}
                                    width={100}
                                    height={100}
                                    src={imageUrl(url)}
                                  />
                                ))}
                              </Image.PreviewGroup>
                            </div>
                          )}
                          <div className="chat-user-text">{item.content}</div>
                        </>
                      ) : (
                        <>
                          <AiMessage
                            content={item.content}
                            reasoningContent={item.reasoningContent}
                            loading={!!item.streaming && sending}
                          />
                          {item.error && (
                            <Alert
                              type="error"
                              title={item.error}
                            />
                          )}
                        </>
                      )}
                    </div>
                    <div className="chat-message-footer">
                      <div className="chat-footer-actions">
                        <Tooltip title={t('plugin.ai:copy')}>
                          <Button
                            type="text"
                            size="small"
                            aria-label={t('plugin.ai:copyMessage')}
                            icon={<CopyOutlined />}
                            disabled={!item.content}
                            onClick={() =>
                              navigator.clipboard
                                .writeText(item.content)
                                .then(() => message.success(t('plugin.ai:copiedSuccessfully')))
                                .catch(() => message.error(t('plugin.ai:copyFailed')))
                            }
                          />
                        </Tooltip>
                        {config.metricsDefaultVisible === '0' && item.metrics && (
                          <div className="chat-message-metrics">
                            {Object.entries({
                              duration: t('plugin.ai:duration'),
                              inputTokens: t('plugin.ai:input'),
                              outputTokens: t('plugin.ai:output'),
                              totalTokens: t('plugin.ai:total'),
                              reasoningTokens: t('plugin.ai:reasoning'),
                            })
                              .filter(([key]) => item.metrics[key] != null)
                              .map(([key, label]) => (
                                <span key={key}>
                                  {label}{' '}
                                  {key === 'duration'
                                    ? `${Number(item.metrics[key]).toFixed(3)} s`
                                    : `${item.metrics[key]} tokens`}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      {item.role === 'assistant' && (agentData?.model || model) && (
                        <Tag className="chat-model-info">
                          {agentData?.model
                            ? `${agentData.model.provider} / ${agentData.model.id}`
                            : `${model.provider} / ${model.modelCode}`}
                        </Tag>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </Spin>
          </div>
        </div>
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <Input.TextArea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={3}
              disabled={sending || historyLoading}
              placeholder={t('plugin.ai:enterYourQuestionEnterToSendShiftEnterFor')}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  !event.metaKey &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault()
                  send()
                }
              }}
              onPaste={(event) => {
                if (vision && event.clipboardData.files.length) {
                  event.preventDefault()
                  upload(event.clipboardData.files)
                }
              }}
            />
            {vision && !!images.length && (
              <div className="chat-selected-images">
                <Image.PreviewGroup>
                  {images.map((url, index) => (
                    <div
                      className="chat-selected-image"
                      key={`${url}-${index}`}
                    >
                      <Image
                        src={imageUrl(url)}
                        width={60}
                        height={60}
                      />
                      <Button
                        type="text"
                        size="small"
                        aria-label={t('plugin.ai:removeImageValue', { arg0: index + 1 })}
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          setImages((previous) => previous.filter((_, i) => i !== index))
                        }
                      />
                    </div>
                  ))}
                </Image.PreviewGroup>
              </div>
            )}
            <div className="chat-input-actions">
              <div className="chat-input-left-actions">
                {vision && (
                  <Tooltip title={t('plugin.ai:uploadImages')}>
                    <Button
                      type="text"
                      shape="circle"
                      aria-label={t('plugin.ai:uploadImages')}
                      icon={<PictureOutlined />}
                      loading={uploading}
                      disabled={sending}
                      onClick={() => imageInput.current?.click()}
                    />
                  </Tooltip>
                )}
                {model?.supportReasoning === 'Y' && (
                  <Button
                    className="chat-reasoning-toggle"
                    size="small"
                    type={reasoning ? 'primary' : 'default'}
                    aria-pressed={reasoning}
                    disabled={sending}
                    icon={<SvgIcon iconClass="deepthink" />}
                    onClick={() => setReasoning((value) => !value)}
                  >
                    {t('plugin.ai:deepReasoning')}
                  </Button>
                )}
              </div>
              <Button
                type="primary"
                danger={sending}
                loading={uploading}
                disabled={
                  !sending && (!modelId || historyLoading || (!input.trim() && !images.length))
                }
                icon={sending ? <StopOutlined /> : <SendOutlined />}
                onClick={sending ? stop : send}
              >
                {sending ? t('plugin.ai:stop') : t('plugin.ai:send')}
              </Button>
            </div>
          </div>
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => upload(event.target.files)}
          />
        </div>
      </main>
      <Modal
        className="chat-config-dialog"
        title={t('plugin.ai:globalUserSettings')}
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={saveConfig}
        okText={t('plugin.ai:save')}
        cancelText={t('plugin.ai:cancel')}
        confirmLoading={saving}
        width={700}
        forceRender
      >
        <Form
          name="plugins-ai-views-chat-index-jsx-editor-0"
          className="ruoyi-dialog-form"
          requiredMark={false}
          colon={false}
          wrapperCol={{ flex: '1 1 0' }}
          labelCol={{ flex: '150px' }}
          form={form}
          layout="horizontal"
        >
          <Row gutter={20}>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="temperature"
                label={t('plugin.ai:defaultTemperature')}
              >
                <InputNumber
                  mode="spinner"
                  placeholder={t('plugin.ai:defaultTemperature')}
                  min={0}
                  max={2}
                  step={0.1}
                  precision={1}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="addHistoryToContext"
                label={t('plugin.ai:includeConversationHistory')}
                {...enabledField}
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="numHistoryRuns"
                label={t('plugin.ai:historyRounds')}
                hidden={includeHistory !== '0'}
                rules={[{ required: includeHistory === '0' }]}
              >
                <InputNumber
                  mode="spinner"
                  placeholder={t('plugin.ai:historyRounds')}
                  min={1}
                  max={20}
                  precision={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="metricsDefaultVisible"
                label={t('plugin.ai:showMetricsByDefault')}
                {...enabledField}
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="visionEnabled"
                label={t('plugin.ai:enableVision')}
                {...enabledField}
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col
              xs={24}
              sm={12}
            >
              <Form.Item
                name="imageMaxSizeMb"
                label={t('plugin.ai:maximumImageSize')}
                rules={[{ required: true }]}
              >
                <InputNumber
                  mode="spinner"
                  placeholder={t('plugin.ai:imageSize')}
                  min={1}
                  max={50}
                  precision={0}
                  suffix="MB"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="systemPrompt"
            label={t('plugin.ai:systemPrompt')}
          >
            <Input.TextArea
              placeholder={t('plugin.ai:setTheGlobalSystemPrompt')}
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
