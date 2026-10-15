import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
async function scan(root) {
  let entries
  try { entries = await readdir(root, { withFileTypes: true }) } catch (e) { if (e.code === 'ENOENT' && root === 'test') return; throw e }
  for (const d of entries) {
    const p = `${root}/${d.name}`
    if (d.isDirectory()) await scan(p)
    else if (/\.(m?js)$/.test(p)) { const r = spawnSync(process.execPath, ['--check', p], { stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status ?? 1) }
  }
}
for (const dir of ['src', 'scripts', 'test']) await scan(dir)
