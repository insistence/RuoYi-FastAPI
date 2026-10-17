import CronField from "./field";
export default function Field(props) {
  return <CronField {...props} name="week" label="周" min={1} max={7} />;
}
