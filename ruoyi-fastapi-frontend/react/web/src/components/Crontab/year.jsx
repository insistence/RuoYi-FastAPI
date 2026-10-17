import CronField from './field'
export default function Field(props) {
  return (
    <CronField
      {...props}
      name="year"
      label="年"
      min={1970}
      max={2099}
    />
  )
}
