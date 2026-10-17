import CronField from "./field";
export default function Field(props) {
  return <CronField {...props} name="min" label="分钟" min={0} max={59} />;
}
