const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const platforms = process.argv.slice(2)
if (!platforms.length)
  throw new Error('Pass platform names, for example: weapp alipay swan tt qq jd')
const cli = path.join(path.dirname(require.resolve('@tarojs/cli/package.json')), 'bin/taro')
const reportDir = path.resolve(__dirname, '../.cache/platform-check')
fs.mkdirSync(reportDir, { recursive: true })
const results = []
for (const platform of platforms) {
  console.log(`Building ${platform}...`)
  const started = Date.now()
  const result = spawnSync(process.execPath, [cli, 'build', '--type', platform], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: 240000,
    windowsHide: true,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  fs.writeFileSync(path.join(reportDir, `${platform}.log`), output)
  let success = result.status === 0 && /built in/.test(output)
  if (platform === 'h5' && success) {
    const html = fs.readFileSync(path.resolve(__dirname, '../dist/h5/index.html'), 'utf8')
    success = /<script[^>]+src=/.test(html) && !html.includes('htmlWebpackPlugin')
  }
  results.push({
    platform,
    success,
    exitCode: result.status,
    durationSeconds: Math.round((Date.now() - started) / 1000),
  })
  console.log(`${platform}: ${success ? 'PASS' : 'FAIL'} (${results.at(-1).durationSeconds}s)`)
  if (!success) console.log(output.slice(-2400))
  fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(results, null, 2))
}
if (results.some((result) => !result.success)) process.exitCode = 1
