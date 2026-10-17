import { useCallback, useEffect, useRef, useState } from "react";
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
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
} from "@ant-design/icons";
import SvgIcon from "@/components/SvgIcon";
import { listModelAll } from "../../api/model";
import {
  cancelChatRun,
  delChatSession,
  getChatSession,
  getUserChatConfig,
  listChatSession,
  saveUserChatConfig,
} from "../../api/chat";
import request from "@/utils/request";
import { getToken } from "@/utils/auth";
import { getDisplayTimezone } from "@/utils/time";
import { parseTime } from "@/utils/ruoyi";
import { confirm, message } from "@/plugins/modal";
import AiMessage from "./components/AiMessage";
import ChatIcon from "./components/ChatIcon";
import { readChatStream } from "./stream";
import "./style.css";

const defaults = {
  temperature: undefined,
  addHistoryToContext: "0",
  numHistoryRuns: 3,
  systemPrompt: "",
  metricsDefaultVisible: "1",
  visionEnabled: "0",
  imageMaxSizeMb: 5,
};
const imageUrl = (url) =>
  /^(https?:|blob:)/.test(url) ? url : import.meta.env.VITE_APP_BASE_API + url;
const enabledField = {
  valuePropName: "checked",
  getValueProps: (value) => ({ checked: value === "0" }),
  normalize: (value) => (value ? "0" : "1"),
};
export default function AiChat() {
  const [models, setModels] = useState([]),
    [modelId, setModelId] = useState(),
    [messages, setMessages] = useState([]),
    [input, setInput] = useState(""),
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
    [form] = Form.useForm();
  const includeHistory = Form.useWatch("addHistoryToContext", form);
  const active = useRef(true),
    stream = useRef(),
    historyRequest = useRef(0),
    imageInput = useRef(),
    history = useRef(),
    content = useRef(),
    autoScroll = useRef(true);
  const model = models.find((item) => item.modelId === modelId),
    vision = model?.supportImages === "Y" && config.visionEnabled === "0";
  const loadSessions = useCallback(async () => {
    setSessionLoading(true);
    try {
      const result = await listChatSession();
      if (active.current)
        setSessions(
          (result.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        );
    } catch {
    } finally {
      if (active.current) setSessionLoading(false);
    }
  }, []);
  async function stop() {
    const current = stream.current;
    if (!current) return;
    stream.current = undefined;
    if (active.current) setSending(false);
    try {
      if (current.runId) await cancelChatRun(current.runId);
    } catch {
    } finally {
      current.controller.abort();
      if (active.current) loadSessions();
    }
  }
  useEffect(() => {
    active.current = true;
    listModelAll()
      .then((result) => {
        if (!active.current) return;
        const values = result.data || [];
        setModels(values);
        if (values.length) {
          setModelId(values[0].modelId);
          setTemperature(values[0].temperature);
        }
      })
      .catch(() => {});
    getUserChatConfig()
      .then((result) => {
        if (active.current && result.data) setConfig({ ...defaults, ...result.data });
      })
      .catch(() => {});
    loadSessions();
    return () => {
      active.current = false;
      historyRequest.current++;
      void stop();
    };
  }, [loadSessions]);
  useEffect(() => {
    if (autoScroll.current && history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    if (!content.current) return;
    const observer = new ResizeObserver(() => {
      if (autoScroll.current && history.current)
        history.current.scrollTop = history.current.scrollHeight;
    });
    observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  async function newChat() {
    await stop();
    historyRequest.current++;
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setAgentData(undefined);
    setImages([]);
    setHistoryLoading(false);
    autoScroll.current = true;
  }
  async function loadSession(id) {
    if (id === sessionId) return;
    await stop();
    const version = ++historyRequest.current;
    setSessionId(id);
    setMessages([]);
    setAgentData(undefined);
    setHistoryLoading(true);
    autoScroll.current = true;
    try {
      const result = await getChatSession(id);
      if (active.current && version === historyRequest.current) {
        setMessages(
          (result.data.messages || []).map((item) => ({
            ...item,
            id: crypto.randomUUID(),
          })),
        );
        setAgentData(result.data.agentData);
      }
    } catch {
    } finally {
      if (active.current && version === historyRequest.current) setHistoryLoading(false);
    }
  }
  async function deleteSession(id) {
    try {
      await confirm("是否确认删除该会话？");
      if (id === sessionId) await stop();
      await delChatSession(id);
      if (id === sessionId) await newChat();
      message.success("删除成功");
      loadSessions();
    } catch {}
  }
  async function send() {
    const text = input.trim(),
      imageList = vision ? [...images] : [];
    if (sending || uploading || historyLoading || (!text && !imageList.length)) return;
    if (!modelId) return message.error("请先选择模型");
    const id = crypto.randomUUID(),
      controller = new AbortController(),
      current = { controller, runId: null };
    stream.current = current;
    setSending(true);
    setInput("");
    setImages([]);
    autoScroll.current = true;
    setMessages((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        images: imageList,
      },
      {
        id,
        role: "assistant",
        content: "",
        reasoningContent: "",
        streaming: true,
      },
    ]);
    let fullText = "",
      fullReasoning = "";
    const update = (patch) => {
      if (active.current && stream.current === current)
        setMessages((previous) =>
          previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        );
    };
    try {
      const response = await fetch(`${import.meta.env.VITE_APP_BASE_API}/ai/chat/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
          "X-Timezone": getDisplayTimezone(),
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
      });
      if (!response.ok) {
        let body;
        try {
          body = await response.json();
        } catch {}
        throw new Error(body?.msg || body?.detail || `请求失败（${response.status}）`);
      }
      await readChatStream(
        response.body,
        (event) => {
          if (stream.current !== current) return;
          switch (event.type) {
            case "content":
              fullText += event.content || "";
              update({ content: fullText });
              break;
            case "reasoning":
              fullReasoning += event.content || "";
              update({ reasoningContent: fullReasoning });
              break;
            case "meta":
              if (event.session_id) setSessionId(event.session_id);
              break;
            case "run_info":
              current.runId = event.run_id;
              break;
            case "metrics":
              update({ metrics: event.metrics });
              break;
            case "error":
              throw new Error(event.error || "生成失败");
            default:
              if (event.code && event.code !== 200) throw new Error(event.msg || "请求失败");
          }
        },
        controller.signal,
      );
    } catch (error) {
      if (error.name !== "AbortError" && stream.current === current) {
        update({ error: error.message });
        message.error(error.message);
      }
    } finally {
      if (active.current)
        setMessages((previous) =>
          previous.map((item) => (item.id === id ? { ...item, streaming: false } : item)),
        );
      if (stream.current === current) {
        stream.current = undefined;
        if (active.current) {
          setSending(false);
          loadSessions();
        }
      }
    }
  }
  async function upload(fileList) {
    if (!vision || sending) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.length + images.length > 10) return message.error("最多只能上传 10 张图片");
    const limit = config.imageMaxSizeMb || 5;
    if (files.some((file) => !file.type.startsWith("image/")))
      return message.error("请选择图片文件");
    if (files.some((file) => file.size > limit * 1024 * 1024))
      return message.error(`单张图片大小不能超过 ${limit} MB`);
    setUploading(true);
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const result = await request({
          url: "/common/upload",
          method: "post",
          data: body,
          headers: { repeatSubmit: false },
        });
        if (!result.fileName) throw new Error("服务器未返回图片地址");
        if (active.current) setImages((previous) => [...previous, result.fileName]);
      }
    } catch (error) {
      if (error.message) message.error(error.message);
    } finally {
      if (active.current) setUploading(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }
  function openConfig() {
    form.resetFields();
    form.setFieldsValue(config);
    setConfigOpen(true);
  }
  async function saveConfig() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveUserChatConfig({
        ...values,
        ...(config.chatConfigId ? { chatConfigId: config.chatConfigId } : {}),
      });
      const result = await getUserChatConfig();
      setConfig({ ...defaults, ...result.data });
      message.success("配置保存成功");
      setConfigOpen(false);
    } catch {
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="app-container ai-chat">
      <aside className="chat-session-sidebar">
        <div className="chat-sidebar-header">
          <Button type="primary" block icon={<PlusOutlined />} onClick={newChat}>
            新建对话
          </Button>
        </div>
        <div className="chat-session-list">
          <Spin spinning={sessionLoading}>
            <nav aria-label="会话历史" className="chat-sessions">
              {sessions.map((session) => (
                <div
                  className={`chat-session ${sessionId === session.sessionId ? "active" : ""}`}
                  key={session.sessionId}
                >
                  <button
                    className="chat-session-select"
                    onClick={() => loadSession(session.sessionId)}
                    aria-current={sessionId === session.sessionId ? "true" : undefined}
                  >
                    <ChatIcon kind="session" className="chat-session-icon" />
                    <span className="chat-session-info">
                      <span className="chat-session-title">{session.sessionTitle || "新对话"}</span>
                      <span className="chat-session-time">{parseTime(session.createdAt)}</span>
                    </span>
                  </button>
                  <Button
                    className="chat-session-delete"
                    type="text"
                    danger
                    aria-label={`删除会话 ${session.sessionTitle || "新对话"}`}
                    icon={<DeleteOutlined />}
                    onClick={() => deleteSession(session.sessionId)}
                  />
                </div>
              ))}
              {!sessions.length && !sessionLoading && (
                <div className="chat-empty-session">暂无历史对话</div>
              )}
            </nav>
          </Spin>
        </div>
      </aside>
      <main className="chat-main">
        <header className="chat-header">
          <span className="chat-header-title">AI 智能助手</span>
          <div className="chat-header-actions">
            <Tooltip title="全局参数配置" placement="bottom">
              <Button
                shape="circle"
                aria-label="全局参数配置"
                icon={<SettingOutlined />}
                onClick={openConfig}
              />
            </Tooltip>
            <Select
              aria-label="选择模型"
              placeholder="选择模型"
              size="large"
              className="chat-model-select"
              value={modelId}
              disabled={sending}
              options={models.map((item) => ({
                value: item.modelId,
                label: `${item.provider}/${item.modelCode}`,
              }))}
              onChange={(value) => {
                setModelId(value);
                setTemperature(models.find((item) => item.modelId === value)?.temperature);
                setImages([]);
              }}
            />
          </div>
        </header>
        <div
          className="chat-history"
          ref={history}
          onScroll={(event) => {
            const element = event.currentTarget;
            autoScroll.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 100;
          }}
        >
          <div ref={content} className={`chat-content${!messages.length ? " is-empty" : ""}`}>
            <Spin spinning={historyLoading}>
              {!messages.length && !historyLoading && (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">
                    <ChatIcon />
                  </div>
                  <h2>你好！我是你的 AI 助手</h2>
                  <p>
                    {models.length
                      ? "请在下方输入问题开始对话..."
                      : "暂无可用模型，请先在模型管理中配置模型。"}
                  </p>
                </div>
              )}
              {messages.map((item) => (
                <article
                  key={item.id}
                  className={`chat-message-row ${item.role === "user" ? "chat-message-user" : "chat-message-ai"}`}
                >
                  <Avatar
                    className="chat-message-avatar"
                    size={40}
                    icon={item.role === "user" ? <ChatIcon kind="user" /> : <ChatIcon />}
                  />
                  <div className="chat-message-wrapper">
                    <div className="chat-message-sender">
                      {item.role === "user" ? "我" : "AI 助手"}
                      {item.createdAt && (
                        <span className="chat-message-time">{parseTime(item.createdAt)}</span>
                      )}
                    </div>
                    <div className="chat-message-bubble">
                      {item.role === "user" ? (
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
                          {item.error && <Alert type="error" title={item.error} />}
                        </>
                      )}
                    </div>
                    <div className="chat-message-footer">
                      <div className="chat-footer-actions">
                        <Tooltip title="复制">
                          <Button
                            type="text"
                            size="small"
                            aria-label="复制消息"
                            icon={<CopyOutlined />}
                            disabled={!item.content}
                            onClick={() =>
                              navigator.clipboard
                                .writeText(item.content)
                                .then(() => message.success("复制成功"))
                                .catch(() => message.error("复制失败"))
                            }
                          />
                        </Tooltip>
                        {config.metricsDefaultVisible === "0" && item.metrics && (
                          <div className="chat-message-metrics">
                            {Object.entries({
                              duration: "耗时",
                              inputTokens: "输入",
                              outputTokens: "输出",
                              totalTokens: "总",
                              reasoningTokens: "推理",
                            })
                              .filter(([key]) => item.metrics[key] != null)
                              .map(([key, label]) => (
                                <span key={key}>
                                  {label}{" "}
                                  {key === "duration"
                                    ? `${Number(item.metrics[key]).toFixed(3)} s`
                                    : `${item.metrics[key]} tokens`}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      {item.role === "assistant" && (agentData?.model || model) && (
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
              placeholder="请输入您的问题... (Enter 发送，Shift + Enter 换行)"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.ctrlKey &&
                  !event.altKey &&
                  !event.metaKey &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  send();
                }
              }}
              onPaste={(event) => {
                if (vision && event.clipboardData.files.length) {
                  event.preventDefault();
                  upload(event.clipboardData.files);
                }
              }}
            />
            {vision && !!images.length && (
              <div className="chat-selected-images">
                <Image.PreviewGroup>
                  {images.map((url, index) => (
                    <div className="chat-selected-image" key={`${url}-${index}`}>
                      <Image src={imageUrl(url)} width={60} height={60} />
                      <Button
                        type="text"
                        size="small"
                        aria-label={`移除图片 ${index + 1}`}
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
                  <Tooltip title="上传图片">
                    <Button
                      type="text"
                      shape="circle"
                      aria-label="上传图片"
                      icon={<PictureOutlined />}
                      loading={uploading}
                      disabled={sending}
                      onClick={() => imageInput.current?.click()}
                    />
                  </Tooltip>
                )}
                {model?.supportReasoning === "Y" && (
                  <Button
                    className="chat-reasoning-toggle"
                    size="small"
                    type={reasoning ? "primary" : "default"}
                    aria-pressed={reasoning}
                    disabled={sending}
                    icon={<SvgIcon iconClass="deepthink" />}
                    onClick={() => setReasoning((value) => !value)}
                  >
                    深度思考
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
                {sending ? "停止" : "发送"}
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
        title="用户全局配置"
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={saveConfig}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        width={700}
        forceRender
      >
        <Form
          name="plugins-ai-views-chat-index-jsx-editor-0"
          className="ruoyi-dialog-form"
          requiredMark={false}
          colon={false}
          wrapperCol={{ flex: "1 1 0" }}
          labelCol={{ flex: "150px" }}
          form={form}
          layout="horizontal"
        >
          <Row gutter={20}>
            <Col xs={24} sm={12}>
              <Form.Item name="temperature" label="默认温度">
                <InputNumber
                  mode="spinner"
                  placeholder="默认温度"
                  min={0}
                  max={2}
                  step={0.1}
                  precision={1}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="addHistoryToContext" label="附带历史消息" {...enabledField}>
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="numHistoryRuns"
                label="历史消息轮数"
                hidden={includeHistory !== "0"}
                rules={[{ required: includeHistory === "0" }]}
              >
                <InputNumber
                  mode="spinner"
                  placeholder="历史消息轮数"
                  min={1}
                  max={20}
                  precision={0}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="metricsDefaultVisible" label="默认显示指标" {...enabledField}>
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="visionEnabled" label="开启视觉功能" {...enabledField}>
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="imageMaxSizeMb" label="图片最大大小" rules={[{ required: true }]}>
                <InputNumber
                  mode="spinner"
                  placeholder="图片大小"
                  min={1}
                  max={50}
                  precision={0}
                  suffix="MB"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="systemPrompt" label="系统提示词">
            <Input.TextArea placeholder="设置全局系统提示词" rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
