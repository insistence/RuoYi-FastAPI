import { Button, Row, Col } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import image from "@/assets/401_images/401.gif";
import "./style.css";
export default function Forbidden(){const navigate=useNavigate(),[query]=useSearchParams();return <main className="errPage-container"><Button className="pan-back-btn" icon={<ArrowLeftOutlined />} onClick={()=>query.has("noGoBack")?navigate("/"):navigate(-1)}>返回</Button><Row><Col span={12}><h1 className="text-jumbo">401错误!</h1><h2>您没有访问权限！</h2><h6>对不起，您没有访问权限，请不要进行非法操作！您可以返回主页面</h6><ul className="list-unstyled"><li><Link to="/">回首页</Link></li></ul></Col><Col span={12}><img src={image} width="313" height="428" alt="Girl has dropped her ice cream." /></Col></Row></main>}
