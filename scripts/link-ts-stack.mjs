import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = join(root, 'frontend')
const sourceArgument = process.argv[2] ?? process.env.TS_STACK_DIR
if (!sourceArgument || process.argv.length > 3) {
  throw new Error('Usage: npm run link:ts-stack -- /path/to/ts-stack (or set TS_STACK_DIR)')
}
const source = realpathSync(resolve(sourceArgument))
if (!existsSync(join(frontend, 'node_modules'))) {
  throw new Error('Install the locked frontend dependencies first: npm --prefix frontend ci')
}

const packages = [
  ['@bsv/sdk', 'packages/sdk'],
  ['@bsv/authsocket-client', 'packages/messaging/authsocket-client'],
  ['@bsv/message-box-client', 'packages/messaging/message-box-client'],
  ['@bsv/wallet-toolbox-client', 'packages/wallet/wallet-toolbox/client']
]
const selected = packages
  .filter(([name]) => name === '@bsv/sdk' || existsSync(join(frontend, 'node_modules', name)))
  .map(([name, directory]) => {
    const location = join(source, directory)
    const manifest = JSON.parse(readFileSync(join(location, 'package.json'), 'utf8'))
    if (manifest.name !== name) throw new Error(`Unexpected package at ${location}`)
    for (const entry of [manifest.main, manifest.module].filter(Boolean)) {
      if (!existsSync(join(location, entry))) {
        throw new Error(`Missing built entry ${name}/${entry}; build the TS Stack checkout first`)
      }
    }
    return { name, location, version: manifest.version }
  })
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: source,
  encoding: 'utf8'
}).trim()

// Keep links inside this consumer's ignored node_modules. npm ci restores the
// registry baseline; no global npm links or saved dependency overrides are used.
for (const { name, location, version } of selected) {
  const destination = join(frontend, 'node_modules', name)
  mkdirSync(dirname(destination), { recursive: true })
  rmSync(destination, { recursive: true, force: true })
  symlinkSync(location, destination, 'dir')
  console.log(`Linked ${name}@${version} -> ${location}`)
}
rmSync(join(frontend, 'node_modules/.vite'), { recursive: true, force: true })

const consumerRequire = createRequire(join(frontend, 'package.json'))
const sdk = realpathSync(consumerRequire.resolve('@bsv/sdk'))
for (const location of [
  frontend,
  dirname(consumerRequire.resolve('@babbage/go')),
  ...selected.map((value) => value.location)
]) {
  const from = createRequire(join(location, '__ts_stack_resolution_check__.cjs'))
  if (realpathSync(from.resolve('@bsv/sdk')) !== sdk) {
    throw new Error(`Multiple SDK copies resolve from ${location}`)
  }
}
console.log(`Verified one shared SDK from TS Stack ${revision}`)
console.log('Start locally: npm run start:local')
