import type { AcceptedPlugin } from 'postcss'
import autoprefixer from 'autoprefixer'

const plugins: AcceptedPlugin[] = [autoprefixer()]

// 可以使用 postcss-pxtransform 来进行 px 转 rpx 的功能
// 详见: https://tw.icebreaker.top/docs/quick-start/css-unit-transform#px-%E8%BD%AC-rpx

export default plugins
