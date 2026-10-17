import { Link } from "react-router-dom";
import logo from "@/assets/logo/logo.png";

export default function Logo({ collapsed = false, top = false }) {
  const title = import.meta.env.VITE_APP_TITLE;
  return (
    <Link to="/index" className={`layout-logo${top ? " layout-top-logo" : ""}`} aria-label={title}>
      <img src={logo} alt="" />
      {!collapsed && <span>{title}</span>}
    </Link>
  );
}
