import { useEffect, useState } from "react";
import { CopyOutlined } from "@ant-design/icons";
import { Button, Modal, Tabs } from "antd";
import { message } from "@/plugins/modal";
import { copyText } from "@/directive/common/copyText";

const fileName = (path) => path.slice(path.lastIndexOf("/") + 1).replace(/\.jinja2$/, "");
const defaultFile = (files) => files.find((path) => fileName(path) === "do.py") || files[0];

export default function CodePreview({ preview, onClose }) {
  const files = Object.keys(preview || {});
  const [activeFile, setActiveFile] = useState(() => defaultFile(files));
  useEffect(() => {
    setActiveFile(defaultFile(Object.keys(preview || {})));
  }, [preview]);

  async function copy(content) {
    try {
      await copyText(content);
      message.success("复制成功");
    } catch {
      message.error("复制失败，请手动复制");
    }
  }

  return (
    <Modal
      title="代码预览"
      className="gen-preview"
      open={!!preview}
      onCancel={onClose}
      footer={null}
      width="80%"
      destroyOnHidden
    >
      <Tabs
        activeKey={activeFile}
        onChange={setActiveFile}
        items={files.map((path) => ({
          key: path,
          label: fileName(path),
          children: (
            <>
              <Button
                className="gen-copy"
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copy(preview[path])}
              >
                复制
              </Button>
              <pre className="gen-preview-code">{preview[path]}</pre>
            </>
          ),
        }))}
      />
    </Modal>
  );
}
