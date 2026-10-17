import Taro from '@tarojs/taro'
export async function cropImage(src, crop, canvasId) {
  const height = Math.max(1, Math.round((400 * crop.height) / crop.width))
  const context = Taro.createCanvasContext(canvasId)
  context.drawImage(src, crop.x, crop.y, crop.width, crop.height, 0, 0, 400, height)
  await new Promise((resolve) => context.draw(false, resolve))
  const result = await Taro.canvasToTempFilePath({
    canvasId,
    x: 0,
    y: 0,
    width: 400,
    height,
    destWidth: 400,
    destHeight: height,
    fileType: 'jpg',
    quality: 0.9,
  })
  return result.tempFilePath
}
