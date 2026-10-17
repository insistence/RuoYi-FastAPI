const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { getMetroConfig } = require('@tarojs/rn-supporter')
module.exports = (async () => {
  const taro = await getMetroConfig()
  return mergeConfig(getDefaultConfig(__dirname), taro, {
    maxWorkers: 2,
    resolver: { unstable_enableSymlinks: true },
  })
})()
