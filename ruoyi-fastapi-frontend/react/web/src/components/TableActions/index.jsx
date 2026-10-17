import { Button, Tooltip } from "antd";
import TableActionIcon from "./TableActionIcon";

// Permission gates and tooltips do not add spacing wrappers around hidden actions.
export default function TableActions({ children, className = "", ...props }) {
  return (
    <span className={`ruoyi-table-actions ${className}`} {...props}>
      {children}
    </span>
  );
}

export function TableAction({
  children,
  iconOnly = false,
  symbol,
  icon,
  tone = "primary",
  danger = false,
  tooltip,
  className = "",
  ...props
}) {
  const label = props["aria-label"] ?? (typeof children === "string" ? children.trim() : undefined);
  const button = (
    <Button
      {...props}
      type="link"
      danger={danger}
      aria-label={iconOnly ? label : props["aria-label"]}
      className={`ruoyi-table-action ruoyi-table-action--${danger ? "danger" : tone} ${className}`}
      icon={symbol ? <TableActionIcon name={symbol} /> : icon}
    >
      {iconOnly ? null : children}
    </Button>
  );
  return iconOnly && tooltip !== false ? (
    <Tooltip title={tooltip ?? label}>
      {props.disabled ? <span className="ruoyi-table-action-disabled">{button}</span> : button}
    </Tooltip>
  ) : (
    button
  );
}
