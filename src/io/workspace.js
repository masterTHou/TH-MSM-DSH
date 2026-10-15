import path from 'node:path'
import { realpath, readFile, mkdir, writeFile, rename } from 'node:fs/promises'
function inside(root, file) {
  const rel = path.relative(root, file)
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error('path escapes workspace')
}
export async function readWorkspaceJSON(workspace, file) {
  const root = await realpath(workspace), lexical = path.resolve(root, file)
  inside(root, lexical)
  const resolved = await realpath(lexical); inside(root, resolved)
  return JSON.parse(await readFile(resolved, 'utf8'))
}
export async function writeWorkspaceText(workspace, file, text) {
  const root = await realpath(workspace), dest = path.resolve(root, file)
  inside(root, dest)
  // Validate each existing parent before creating any children through a symlink.
  let current = root
  for (const part of path.relative(root, path.dirname(dest)).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    try { inside(root, await realpath(current)) } catch (e) { if (e.code !== 'ENOENT') throw e; await mkdir(current) }
  }
  try { inside(root, await realpath(dest)) } catch (e) { if (e.code !== 'ENOENT') throw e }
  const temp = `${dest}.${process.pid}.${crypto.randomUUID()}.tmp`
  await writeFile(temp, text, { flag: 'wx' }); await rename(temp, dest)
  return dest
}
