import "./style.css";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button, List, Progress, Space, Tag, Tooltip, Upload } from "antd";
import { UploadOutlined, UpOutlined, DownOutlined } from "@ant-design/icons";
import request from "@/utils/request";
import download from "@/plugins/download";
import { message } from "@/plugins/modal";
import { appendUploadData, normalizeFiles, uploadedFile, validateFile } from "./model";

export default function BusinessFileUpload({
  ref,
  value,
  onChange,
  onFilesChange,
  action = "/common/files/upload",
  data = {},
  limit = 5,
  fileSize = 5,
  fileType = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "pdf"],
  isShowTip = true,
  disabled = false,
  drag = true,
}) {
  const [files, setFiles] = useState(() => normalizeFiles(value));
  const [pending, setPending] = useState([]);
  const saved = useRef(files),
    active = useRef(new Map()),
    mounted = useRef(true),
    dragged = useRef();
  useEffect(() => {
    saved.current = normalizeFiles(value);
    setFiles(saved.current);
  }, [value]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const entry of active.current.values()) entry.controller?.abort();
      active.current.clear();
    };
  }, []);
  useImperativeHandle(
    ref,
    () => ({ getFileIds: () => saved.current.map((file) => file.fileId) }),
    [],
  );
  function publish(next) {
    saved.current = normalizeFiles(next);
    setFiles(saved.current);
    onChange?.(saved.current);
    onFilesChange?.(
      saved.current,
      saved.current.map((file) => file.fileId),
    );
  }
  function syncPending() {
    if (mounted.current) setPending([...active.current.values()]);
  }
  function reserve(file) {
    const error = validateFile(file, {
      count:
        saved.current.length +
        [...active.current.values()].filter((f) => f.status === "uploading").length,
      limit,
      fileSize,
      fileType,
    });
    if (error) {
      message.error(error);
      return false;
    }
    active.current.set(file.uid, {
      uid: file.uid,
      raw: file,
      name: file.name,
      status: "uploading",
      percent: 0,
    });
    syncPending();
    return true;
  }
  async function send(file, options = {}) {
    const entry = active.current.get(file.uid);
    if (!entry) return;
    entry.controller = new AbortController();
    const body = new FormData();
    body.append("file", file);
    appendUploadData(body, data);
    try {
      const response = await request({
        url: action,
        method: "post",
        data: body,
        timeout: 120000,
        signal: entry.controller.signal,
        headers: { "Content-Type": "multipart/form-data", repeatSubmit: false },
        onUploadProgress(event) {
          if (event.total) {
            entry.percent = Math.round((event.loaded / event.total) * 100);
            syncPending();
            options.onProgress?.({ percent: entry.percent });
          }
        },
      });
      const next = uploadedFile(response, file.name);
      if (!mounted.current) return;
      active.current.delete(file.uid);
      publish([...saved.current.filter((item) => item.fileId !== next.fileId), next]);
      options.onSuccess?.(response);
    } catch (error) {
      if (!mounted.current) return;
      entry.status = "failed";
      entry.error = error.message || "上传失败，请重试";
      options.onError?.(error);
    } finally {
      syncPending();
    }
  }
  function reorder(from, to) {
    if (disabled || !drag || from == null || from < 0 || to < 0 || to >= saved.current.length)
      return;
    const next = [...saved.current];
    next.splice(to, 0, next.splice(from, 1)[0]);
    publish(next);
    dragged.current = undefined;
  }
  return (
    <Space orientation="vertical" className="business-file-upload">
      {!disabled && (
        <Upload
          multiple
          showUploadList={false}
          accept={fileType.map((type) => `.${type}`).join(",")}
          beforeUpload={(file) => reserve(file) || Upload.LIST_IGNORE}
          customRequest={(options) => {
            void send(options.file, options);
            return { abort: () => active.current.get(options.file.uid)?.controller?.abort() };
          }}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      )}
      {isShowTip && !disabled && (
        <small>
          请上传{fileSize > 0 && `大小不超过 ${fileSize} MB、`}
          {fileType.length > 0 && `格式为 ${fileType.join("/")} 的`}文件，最多上传 {limit} 个
        </small>
      )}
      {!!files.length && (
        <List
          size="small"
          bordered
          dataSource={files}
          rowKey="fileId"
          renderItem={(file, index) => (
            <List.Item
              draggable={drag && !disabled}
              onDragStart={() => {
                dragged.current = index;
              }}
              onDragOver={(e) => {
                if (drag && !disabled) e.preventDefault();
              }}
              onDragEnd={() => {
                dragged.current = undefined;
              }}
              onDrop={(e) => {
                e.preventDefault();
                reorder(dragged.current, index);
              }}
              actions={[
                <Button key="download" type="link" onClick={() => download.file(file.url)}>
                  下载
                </Button>,
                ...(!disabled
                  ? [
                      <Button
                        key="remove"
                        danger
                        type="link"
                        onClick={() =>
                          publish(saved.current.filter((item) => item.fileId !== file.fileId))
                        }
                      >
                        删除
                      </Button>,
                    ]
                  : []),
                ...(drag && !disabled
                  ? [
                      <Button
                        key="up"
                        type="text"
                        aria-label={`上移 ${file.name}`}
                        disabled={index === 0}
                        icon={<UpOutlined />}
                        onClick={() => reorder(index, index - 1)}
                      />,
                      <Button
                        key="down"
                        type="text"
                        aria-label={`下移 ${file.name}`}
                        disabled={index === files.length - 1}
                        icon={<DownOutlined />}
                        onClick={() => reorder(index, index + 1)}
                      />,
                    ]
                  : []),
              ]}
            >
              <div className="upload-file-label">
                <span title={file.name}>{file.name}</span>
                <Tag color="success">已上传</Tag>
              </div>
            </List.Item>
          )}
        />
      )}
      {!!pending.length && (
        <List
          size="small"
          bordered
          dataSource={pending}
          rowKey="uid"
          renderItem={(file) => (
            <List.Item
              actions={
                file.status === "failed" && !disabled
                  ? [
                      <Button
                        key="retry"
                        type="link"
                        onClick={() => {
                          if (reserve(file.raw)) void send(file.raw);
                        }}
                      >
                        重试
                      </Button>,
                      <Button
                        key="remove"
                        danger
                        type="link"
                        onClick={() => {
                          active.current.delete(file.uid);
                          syncPending();
                        }}
                      >
                        删除
                      </Button>,
                    ]
                  : []
              }
            >
              <div className="upload-file-label">
                <span>{file.name}</span>
                {file.status === "uploading" ? (
                  <Progress size="small" percent={file.percent} style={{ width: 100 }} />
                ) : (
                  <Tooltip title={file.error}>
                    <Tag color="error">上传失败</Tag>
                  </Tooltip>
                )}
              </div>
            </List.Item>
          )}
        />
      )}
    </Space>
  );
}
