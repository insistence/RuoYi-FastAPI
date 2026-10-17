import { Button, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
export default function RuoYiDoc() {
  return (
    <Tooltip title="帮助文档">
      <Button
        type="text"
        aria-label="帮助文档"
        href="https://doc.ruoyi.vip/ruoyi-vue"
        target="_blank"
        rel="noopener noreferrer"
        icon={<QuestionCircleOutlined />}
      />
    </Tooltip>
  );
}
