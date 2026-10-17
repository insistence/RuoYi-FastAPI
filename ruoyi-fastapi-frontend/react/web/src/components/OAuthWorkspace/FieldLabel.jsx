import { Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import "./style.css";
export default function FieldLabel({ label, help, children }) {
  return (
    <span className="oauth-field-label">
      {label || children}
      {help && (
        <Tooltip title={help} trigger={["hover", "focus", "click"]}>
          <span
            className="oauth-field-help"
            tabIndex={0}
            role="img"
            aria-label={`${label || "字段"}说明：${help}`}
          >
            <QuestionCircleOutlined />
          </span>
        </Tooltip>
      )}
    </span>
  );
}
