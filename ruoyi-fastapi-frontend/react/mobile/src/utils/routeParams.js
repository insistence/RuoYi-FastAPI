// Taro passes encoded query values through onLoad on H5 and mini programs.
// Decode one layer only so literal percent signs and nested URL queries survive.
export function decodeRouteParam(value = '') {
  if (typeof value !== 'string') return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
