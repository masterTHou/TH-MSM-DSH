import path from 'node:path'
import { realpath, mkdir, stat } from 'node:fs/promises'
function inside(root, candidate) {
  const relative = path.relative(root, candidate)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('path escapes workspace')
}
export async function scopedPath(workspace, file) {
  const root = await realpath(workspace)
  if (!(await stat(root)).isDirectory()) throw new Error('workspace must be a directory')
  const target = path.resolve(root, file); inside(root, target)
  let cursor = root
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part)
    try { inside(root, await realpath(cursor)) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return target
}
export async function freshDirectory(workspace, folder) {
  const root = await realpath(workspace), target = await scopedPath(root, folder)
  if (target === root) throw new Error('output directory must not be the workspace root')
  let cursor = root
  const parts = path.relative(root, target).split(path.sep)
  for (const part of parts.slice(0, -1)) {
    cursor = path.join(cursor, part)
    try { await mkdir(cursor) } catch (error) { if (error.code !== 'EEXIST') throw error }
    inside(root, await realpath(cursor))
  }
  // Atomic claim: two workflows cannot silently overwrite the same output.
  try { await mkdir(target) } catch (error) { if (error.code === 'EEXIST') throw new Error('OUTPUT_EXISTS: choose a new output directory'); throw error }
  return target
}
