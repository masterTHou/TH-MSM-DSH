// Exercise the release tarball outside the checkout, with only host peers linked.
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const tarball = path.resolve(process.argv[2] ?? '')
assert.ok(process.argv[2], 'usage: node scripts/smoke-package.mjs <release.tgz>')
const require = createRequire(import.meta.url)
const workspace = await mkdtemp(path.join(tmpdir(), 'th-msm-package-'))
try {
  await mkdir(path.join(workspace, 'node_modules'), { recursive: true })
  // Extract without installing dependencies: bundled numerical dependencies must suffice.
  const packageDir = path.join(workspace, 'node_modules', '@th-msm', 'dsh-plugin')
  await mkdir(packageDir, { recursive: true })
  const unpack = spawnSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', packageDir], { encoding: 'utf8' })
  assert.equal(unpack.status, 0, unpack.stderr)
  const manifest = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'))
  for (const peer of Object.keys(manifest.peerDependencies)) {
    let root = path.dirname(require.resolve(peer))
    while (JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8').catch(() => '{}')).name !== peer) {
      assert.notEqual(path.dirname(root), root, `cannot locate host peer ${peer}`)
      root = path.dirname(root)
    }
    const link = path.join(workspace, 'node_modules', peer)
    await mkdir(path.dirname(link), { recursive: true })
    await symlink(root, link, process.platform === 'win32' ? 'junction' : 'dir')
  }
  const installedRequire = createRequire(path.join(workspace, 'host.cjs'))
  const entry = installedRequire.resolve(manifest.name)
  assert.equal(entry, path.join(packageDir, 'lib', 'index.js'))
  const plugin = await import(pathToFileURL(entry).href)
  const tools = []
  plugin.apply({ shell: { sandboxMode: 'workspace-write' }, get: () => ({}),
    tools: { register: tool => tools.push(tool), guard() {} }, on() {}, inject() {} })
  assert.equal(new Set(tools.map(tool => tool.name)).size, 12)
  const result = await tools.find(tool => tool.name === 'th_msm_teach').execute({ concept: 'msm', level: 'undergraduate' }, {})
  assert.equal(result.ok, true)
  console.log(`Release ${manifest.version}: resolve, import, 12 tool registrations and teaching passed outside checkout.`)
} finally {
  assert.equal(path.dirname(workspace), tmpdir())
  await rm(workspace, { recursive: true, force: true })
}
