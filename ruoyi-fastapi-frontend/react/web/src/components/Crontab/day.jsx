import CronField from './field'
export default function Field(props) {
  return (
    <CronField
      {...props}
      name="day"
      label="日"
      min={1}
      max={31}
    />
  )
}
