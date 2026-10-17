import CronField from "./field";
export default function Field(props) {
  return <CronField {...props} name="hour" label="小时" min={0} max={23} />;
}
