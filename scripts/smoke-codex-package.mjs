import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
if (!process.argv[2]) throw new Error('usage: node scripts/smoke-codex-package.mjs <release.tar.gz>')
const root = await mkdtemp(path.join(tmpdir(), 'th-msm-codex-package-'))
try {
  const unpack = spawnSync('tar', ['-xzf', path.resolve(process.argv[2]), '-C', root], { encoding: 'utf8' })
  if (unpack.status !== 0) throw new Error(unpack.stderr)
  const test = spawnSync(process.execPath, ['--test', 'test/codex.test.mjs'], { stdio: 'inherit', env: { ...process.env, TH_MSM_TEST_SERVER: path.join(root, 'server/index.mjs') } })
  if (test.status !== 0) throw new Error('isolated Codex release smoke test failed')
} finally {
  if (path.dirname(root) !== tmpdir()) throw new Error('invalid cleanup root')
  await rm(root, { recursive: true, force: true })
}
