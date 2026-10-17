import './style.css'
const files = import.meta.glob('../../assets/icons/svg/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})
export default function SvgIcon({ iconClass, style, className = '', ...props }) {
  const src = files[`../../assets/icons/svg/${iconClass}.svg`]
  return src ? (
    <span
      aria-hidden="true"
      {...props}
      className={'svg-icon ' + className}
      style={{ '--svg-icon-url': `url("${src}")`, ...style }}
    />
  ) : null
}
