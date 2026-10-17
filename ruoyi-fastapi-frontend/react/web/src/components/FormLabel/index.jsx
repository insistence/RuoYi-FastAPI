import { Tooltip } from "antd";
import { QuestionCircleFilled } from "@ant-design/icons";
import "./style.css";

export default function FormLabel({ label, help }) {
  return (
    <span className="ruoyi-form-label">
      {help && (
        <Tooltip title={help} trigger={["hover", "focus", "click"]}>
          <button
            type="button"
            className="ruoyi-form-label-help"
            aria-label={`${label}说明`}
            onClick={(event) => event.preventDefault()}
          >
            <QuestionCircleFilled />
          </button>
        </Tooltip>
      )}
      {label}
    </span>
  );
}
