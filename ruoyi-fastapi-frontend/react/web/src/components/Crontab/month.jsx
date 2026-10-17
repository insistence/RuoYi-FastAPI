import CronField from "./field";
export default function Field(props) {
  return <CronField {...props} name="month" label="月" min={1} max={12} />;
}
