// Vite already installs its React transform. Applying the Taro Webpack preset
// there injects React Refresh twice and transforms dependency prebundles again.
module.exports =
  process.env.TARO_ENV === 'rn'
    ? {
        presets: [['taro', { framework: 'react', ts: false }]],
        plugins: [require.resolve('./scripts/native-classes.cjs')],
      }
    : {}
