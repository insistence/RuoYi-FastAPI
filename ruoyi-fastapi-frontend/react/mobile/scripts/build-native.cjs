const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const platform = process.argv[2] || 'android'
if (!['android', 'ios'].includes(platform)) throw new Error('Expected android or ios')
const options = process.argv.slice(3)
if (options.some((option) => option !== '--reset-cache'))
  throw new Error('Supported option: --reset-cache')
const directory = path.resolve(__dirname, '../dist/rn', platform)
fs.mkdirSync(directory, { recursive: true })
// Run the same Metro configuration as Taro, propagating Metro's exit code.
// Taro 4.2 rn-runner spawns the CLI without propagating compilation failures.
const result = spawnSync(
  process.execPath,
  [
    require.resolve('react-native/cli.js'),
    'bundle',
    '--platform',
    platform,
    '--dev',
    'false',
    ...options,
    '--entry-file',
    'index.js',
    '--bundle-output',
    path.join(directory, platform === 'ios' ? 'main.jsbundle' : 'index.bundle'),
    '--assets-dest',
    directory,
  ],
  {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, TARO_ENV: 'rn', NODE_ENV: 'production' },
  }
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
