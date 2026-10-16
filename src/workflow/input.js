import { stat } from 'node:fs/promises'
import { scopedPath } from './paths.js'
import { readWorkspaceJSON } from '../io/workspace.js'
export async function readClassicalInput(workspace, file) {
  const info = await stat(await scopedPath(workspace, file))
  if (!info.isFile()) throw new Error('input must be a regular JSON file')
  if (info.size > 64 * 1024 * 1024) throw new Error('input JSON exceeds the 64 MiB workflow limit; use a separately designed large-data backend')
  const data = await readWorkspaceJSON(workspace, file)
  if (!['classical-trajectories', 'classical-features'].includes(data.kind)) throw new Error('expected classical dataset; model artifacts, XTC/DCD and C1 runs need a different workflow')
  return data
}
