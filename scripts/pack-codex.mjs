import { spawnSync } from 'node:child_process'
import { mkdir, readFile, readdir, lstat } from 'node:fs/promises'
import path from 'node:path'
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const root = 'plugins/th-msm'
for (const file of ['plugin.json', '.codex-plugin/plugin.json']) {
  const manifest = JSON.parse(await readFile(`${root}/${file}`, 'utf8'))
  if (manifest.name !== 'th-msm' || manifest.version !== pkg.version) throw new Error('Codex manifest identity/version mismatch')
}
const portable = JSON.parse(await readFile(`${root}/plugin.json`, 'utf8'))
const compat = JSON.parse(await readFile(`${root}/.codex-plugin/plugin.json`, 'utf8'))
if (portable.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') throw new Error('missing portable manifest schema')
if (JSON.stringify(portable.extensions['com.openai'].interface) !== JSON.stringify(compat.interface)) throw new Error('Codex presentation manifests diverged')
if (portable.extensions['com.openai'].interface.shortDescription.length > 30) throw new Error('plugin subtitle too long')
for (const file of ['mcp.json', '.mcp.json']) {
  const config = JSON.parse(await readFile(`${root}/${file}`, 'utf8'))
  if (config.mcpServers['th-msm'].command !== 'node' || config.mcpServers['th-msm'].args[0] !== '${PLUGIN_ROOT}/server/index.mjs') throw new Error('invalid portable server entry')
}
const skill = await readFile(`${root}/skills/th-msm/SKILL.md`, 'utf8')
if (!/^---\r?\nname: th-msm\r?\ndescription: .+\r?\n---/.test(skill)) throw new Error('invalid skill frontmatter')
async function scan(dir) {
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name), info = await lstat(file)
    if (info.isSymbolicLink() || ['node_modules', '.git', '.env'].includes(name)) throw new Error(`unexpected release file: ${file}`)
    if (info.isDirectory()) await scan(file)
  }
}
await scan(root)
await mkdir('dist', { recursive: true })
const archive = path.resolve(`dist/th-msm-codex-plugin-${pkg.version}.tar.gz`)
const packed = spawnSync('tar', ['-czf', archive, '-C', root, '.'], { encoding: 'utf8' })
if (packed.status !== 0) throw new Error(packed.stderr)
console.log(archive)
