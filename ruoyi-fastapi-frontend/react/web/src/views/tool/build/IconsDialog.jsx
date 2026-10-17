import "./style.css";
import { Modal } from "antd";
import IconSelect from "@/components/IconSelect";
export default function IconsDialog({ open, value, onClose, onSelect }) {
  return (
    <Modal
      width="980px"
      className="builder-icons-dialog"
      title="选择图标"
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <IconSelect
        inline
        placeholder="请输入图标名称"
        value={value}
        style={{ width: "100%" }}
        onChange={(value) => {
          onSelect(value || "");
          onClose();
        }}
      />
    </Modal>
  );
}
