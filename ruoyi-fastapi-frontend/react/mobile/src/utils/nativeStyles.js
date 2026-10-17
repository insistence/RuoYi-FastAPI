// Native equivalents of the utility classes used by these pages. Web/mini
// programs continue to use the Tailwind v4 / weapp-tailwindcss compiler.
const colors = {
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb' },
  indigo: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    500: '#6366f1',
    600: '#4f46e5',
  },
  purple: { 50: '#faf5ff', 200: '#e9d5ff', 500: '#a855f7', 600: '#9333ea' },
  green: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
  red: { 50: '#fef2f2', 500: '#ef4444', 600: '#dc2626' },
  orange: { 50: '#fff7ed', 500: '#f97316' },
  yellow: { 50: '#fefce8', 500: '#eab308', 600: '#ca8a04' },
  pink: { 50: '#fdf2f8', 500: '#ec4899' },
  cyan: { 50: '#ecfeff', 500: '#06b6d4' },
}
export function nativeColor(value) {
  if (value === 'transparent') return 'transparent'
  const [color, alpha] = value.split('/')
  const [family, shade] = color.split('-')
  const hex = shade ? colors[family]?.[shade] : colors[family]
  if (!hex || typeof hex !== 'string') return undefined
  if (!alpha) return hex
  const number = parseInt(hex.slice(1), 16)
  return `rgba(${number >> 16},${(number >> 8) & 255},${number & 255},${Number(alpha) / 100})`
}
const custom = {
  'list-page': {
    flexGrow: 1,
    backgroundColor: '#f9fafb',
    paddingTop: 16,
    paddingBottom: 40,
  },
  'mobile-page': {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 20,
    backgroundColor: '#f7f8fa',
  },
  'mobile-card': {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  'mobile-field': { marginBottom: 20 },
  'mobile-label': {
    lineHeight: 20,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  'mobile-input': {
    width: '100%',
    height: 44,
    backgroundColor: '#f9fafb',
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    textAlignVertical: 'center',
    fontSize: 14,
  },
  'mobile-button': {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 44,
  },
  'mobile-button-danger': {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    marginTop: 0,
  },
  'mobile-error': { color: '#dc2626', fontSize: 14, marginVertical: 8 },
  'mobile-row': {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
    fontSize: 14,
  },
  'mobile-muted': { color: '#6b7280', fontSize: 14 },
  'auth-screen': {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    padding: 24,
    paddingTop: 0,
    paddingBottom: 80,
  },
  'auth-logo': {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'white',
    marginBottom: 16,
  },
  'auth-title': {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  'auth-panel': {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 24,
  },
  'auth-footer': {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginTop: 24,
    fontSize: 12,
    color: '#9ca3af',
  },
  'auth-link': { color: '#3b82f6' },
  'auth-register-link': { fontSize: 14, color: '#6b7280' },
  'auth-field': { position: 'relative', marginBottom: 20, width: '100%' },
  'auth-field-icon': {
    position: 'absolute',
    left: 16,
    top: 14,
    fontSize: 20,
    color: '#9ca3af',
    zIndex: 1,
  },
  'auth-input': {
    width: '100%',
    height: 48,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingLeft: 48,
    paddingRight: 16,
    textAlignVertical: 'center',
    fontSize: 14,
    color: '#374151',
  },
  'auth-submit': { marginTop: 0 },
  'auth-captcha': {},
  'module-caption': { fontSize: 11 },
  'mobile-toggle': {
    flexDirection: 'row',
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  'avatar-actions': { paddingHorizontal: 24 },
  'avatar-button': { marginTop: 16, borderRadius: 9999 },
  'avatar-submit': { backgroundColor: '#ef4444' },
  'legal-content': { lineHeight: 25, fontSize: 14 },
  'crop-stage': {
    position: 'relative',
    overflow: 'hidden',
    marginVertical: 16,
    alignSelf: 'center',
  },
  'crop-frame': {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#60a5fa',
  },
  'crop-handle': {
    position: 'absolute',
  },
  'crop-handle-top': { top: -12, left: 0, width: '100%', height: 24 },
  'crop-handle-bottom': { bottom: -12, left: 0, width: '100%', height: 24 },
  'crop-handle-left': { left: -12, top: 0, width: 24, height: '100%' },
  'crop-handle-right': { right: -12, top: 0, width: 24, height: '100%' },
  'crop-handle-bottom-right': {
    right: -8,
    bottom: -8,
    width: 16,
    height: 16,
    backgroundColor: '#60a5fa',
  },
}
const textSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
}
const radii = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
}
export function nativeStyles(classes = '', viewport = { width: 375, height: 667 }) {
  const style = {}
  const meta = {}
  const unknown = []
  for (const name of classes.trim().split(/\s+/).filter(Boolean)) {
    if (custom[name]) {
      Object.assign(style, custom[name])
      if (name === 'auth-screen' || name === 'auth-submit') {
        meta.gradient = true
        meta.from = name === 'auth-screen' ? '#eff6ff' : '#3b82f6'
        meta.to = name === 'auth-screen' ? '#e0e7ff' : '#4f46e5'
        meta.diagonal = name === 'auth-screen'
      }
      if (name === 'avatar-button' || name === 'avatar-submit') {
        meta.gradient = true
        meta.from = name === 'avatar-submit' ? '#ef4444' : '#3b82f6'
        meta.to = name === 'avatar-submit' ? '#dc2626' : '#2563eb'
      }
      continue
    }
    let match
    if (name.startsWith('i-mdi-')) {
      meta.icon = name.slice(6)
      continue
    }
    if (name === 'grid') {
      style.flexDirection = 'row'
      style.flexWrap = 'wrap'
      continue
    }
    if ((match = name.match(/^grid-cols-(\d+)$/))) {
      meta.columns = Number(match[1])
      continue
    }
    if (name === 'bg-linear-to-r') {
      meta.gradient = true
      continue
    }
    if ((match = name.match(/^(from|to)-(.+)$/))) {
      meta[match[1]] = nativeColor(match[2])
      continue
    }
    if (name === 'block') continue
    if (name === 'break-all') {
      style.flexShrink = 1
      continue
    }
    if (name === 'flex') {
      style.flexDirection = 'row'
      continue
    }
    if (name === 'flex-col') {
      style.flexDirection = 'column'
      continue
    }
    if (name === 'flex-wrap') {
      style.flexWrap = 'wrap'
      continue
    }
    if (name === 'flex-1') {
      style.flex = 1
      continue
    }
    if (name === 'shrink-0') {
      style.flexShrink = 0
      continue
    }
    if (name === 'relative' || name === 'absolute') {
      style.position = name
      continue
    }
    if (name === 'overflow-hidden') {
      style.overflow = 'hidden'
      continue
    }
    if ((match = name.match(/^items-(center|start|end|stretch)$/))) {
      style.alignItems = { start: 'flex-start', end: 'flex-end' }[match[1]] || match[1]
      continue
    }
    if ((match = name.match(/^justify-(center|between|start|end|around)$/))) {
      style.justifyContent =
        {
          between: 'space-between',
          around: 'space-around',
          start: 'flex-start',
          end: 'flex-end',
        }[match[1]] || match[1]
      continue
    }
    if ((match = name.match(/^font-(medium|semibold|bold)$/))) {
      style.fontWeight = { medium: '500', semibold: '600', bold: '700' }[match[1]]
      continue
    }
    if ((match = name.match(/^text-(.+)$/))) {
      const value = match[1]
      if (textSizes[value]) {
        style.fontSize = textSizes[value]
        style.lineHeight = Math.round(textSizes[value] * 1.5)
        continue
      }
      if (['center', 'left', 'right', 'justify'].includes(value)) {
        style.textAlign = value
        continue
      }
      if (nativeColor(value)) {
        style.color = nativeColor(value)
        continue
      }
    }
    if ((match = name.match(/^bg-(.+)$/)) && nativeColor(match[1])) {
      style.backgroundColor = nativeColor(match[1])
      continue
    }
    if ((match = name.match(/^border(?:-(.+))?$/))) {
      const value = match[1]
      if (!value || /^\d+$/.test(value)) {
        style.borderWidth = value ? Number(value) : 1
        continue
      }
      if (value === 'b') {
        style.borderBottomWidth = 1
        continue
      }
      if (nativeColor(value)) {
        style.borderColor = nativeColor(value)
        continue
      }
    }
    if ((match = name.match(/^rounded-(?:(b)-)?(.+)$/)) && radii[match[2]] !== undefined) {
      if (match[1]) {
        style.borderBottomLeftRadius = radii[match[2]]
        style.borderBottomRightRadius = radii[match[2]]
      } else style.borderRadius = radii[match[2]]
      continue
    }
    if ((match = name.match(/^(-?)(p|m)([xytrbl]?)-(\d+(?:\.\d+)?)$/))) {
      const size = Number(match[4]) * 4 * (match[1] ? -1 : 1),
        base = match[2] === 'p' ? 'padding' : 'margin'
      const suffixes = {
        x: ['Left', 'Right'],
        y: ['Top', 'Bottom'],
        t: ['Top'],
        r: ['Right'],
        b: ['Bottom'],
        l: ['Left'],
        '': [''],
      }
      for (const suffix of suffixes[match[3]]) style[base + suffix] = size
      continue
    }
    if ((match = name.match(/^(?:gap(?:-([xy]))?|space-([xy]))-(\d+(?:\.\d+)?)$/))) {
      style[
        (match[1] || match[2]) === 'x'
          ? 'columnGap'
          : (match[1] || match[2]) === 'y'
            ? 'rowGap'
            : 'gap'
      ] = Number(match[3]) * 4
      continue
    }
    if ((match = name.match(/^(-?)(top|right|bottom|left)-(\d+(?:\.\d+)?)$/))) {
      style[match[2]] = Number(match[3]) * 4 * (match[1] ? -1 : 1)
      continue
    }
    if ((match = name.match(/^(min-h|h|w|size)-(full|screen|\d+(?:\.\d+)?)$/))) {
      const key = match[1],
        value = match[2]
      const size =
        value === 'full'
          ? '100%'
          : value === 'screen'
            ? key === 'w'
              ? viewport.width
              : viewport.height
            : Number(value) * 4
      if (key === 'size') {
        style.width = size
        style.height = size
      } else style[key === 'w' ? 'width' : key === 'min-h' ? 'minHeight' : 'height'] = size
      continue
    }
    if ((match = name.match(/^opacity-(\d+)$/))) {
      style.opacity = Number(match[1]) / 100
      continue
    }
    if ((match = name.match(/^z-(\d+)$/))) {
      style.zIndex = Number(match[1])
      continue
    }
    if (name === 'leading-relaxed') {
      style.lineHeight = 24
      continue
    }
    if (name === 'leading-normal') {
      style.lineHeight = 24
      continue
    }
    if (name === 'underline') {
      style.textDecorationLine = 'underline'
      continue
    }
    if ((match = name.match(/^leading-(\d+)$/))) {
      style.lineHeight = Number(match[1]) * 4
      continue
    }
    if (name.startsWith('shadow-')) {
      style.shadowColor = '#000'
      style.shadowOpacity = 0.07
      style.shadowRadius = 8
      style.shadowOffset = { width: 0, height: 3 }
      style.elevation = 2
      continue
    }
    // Cosmetic CSS effects have no equivalent in this RN version.
    if (/^(active:|transition-|blur-|backdrop-blur-)/.test(name)) continue
    unknown.push(name)
  }
  return { style, meta, unknown }
}
export const textStyleKeys = [
  'color',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textDecorationLine',
]
export const textStyles = (style) =>
  Object.fromEntries(
    textStyleKeys.filter((key) => style[key] !== undefined).map((key) => [key, style[key]])
  )
