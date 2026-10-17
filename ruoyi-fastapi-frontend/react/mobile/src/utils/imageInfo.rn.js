import { Image } from 'react-native'
export function imageInfo(src) {
  if (typeof src === 'number') {
    const asset = Image.resolveAssetSource(src)
    return Promise.resolve({
      width: asset.width,
      height: asset.height,
      path: asset.uri,
    })
  }
  return new Promise((resolve, reject) =>
    Image.getSize(src, (width, height) => resolve({ width, height, path: src }), reject)
  )
}
