import CronField from "./field";
export default function Field(props) {
  return <CronField {...props} name="second" label="秒" min={0} max={59} />;
}
