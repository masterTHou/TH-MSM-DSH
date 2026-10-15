import { createReadStream } from 'node:fs'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { validateFrame } from '../core/frame.js'
import { candidateVisits } from '../analysis/partition.js'
import { readWorkspaceJSON } from './workspace.js'

// Stream direct FC histories; WE histories require the explicit resampling/event ledger.
export async function directFramesToRun(frames, manifest) {
  if (manifest.schema_version !== 1 || manifest.mode !== 'direct' || manifest.initialization !== 'FC' || !manifest.protocol?.fc || !manifest.run_id || !Number.isFinite(manifest.horizon_fs) || manifest.horizon_fs <= 0 || !Number.isSafeInteger(manifest.exploration_es_calls) || manifest.exploration_es_calls < 0) throw new Error('direct FC manifest with explicit exploration_es_calls required')
  const run = { ...structuredClone(manifest), events: [], initial_states: [], cost: { total_es_calls: manifest.exploration_es_calls, model_evaluations: 0 }, surviving_weight: 0 }
  const tracks = new Map()
  for await (const raw of frames) {
    const f = structuredClone(validateFrame(raw))
    if (f.parent_id !== null || f.time_fs > manifest.horizon_fs + 1e-10) throw new Error('raw-frame adapter supports unbranched direct histories within horizon only')
    let t = tracks.get(f.traj_id)
    if (!t) {
      if (f.time_fs !== 0 || f.step !== 0 || f.channel_sink_id !== null || f.hop_event.occurred) throw new Error('each direct history must start with an unabsorbed FC frame')
      t = { last: f, hits: false, history: [], visited: new Set() }; tracks.set(f.traj_id, t); run.initial_states.push(f)
    } else {
      if (f.time_fs <= t.last.time_fs || f.step <= t.last.step || f.weight !== t.last.weight) throw new Error('direct times/steps must increase and weight must remain fixed')
      if (t.hits && (f.channel_sink_id !== t.last.channel_sink_id || f.hop_event.occurred)) throw new Error('absorbing sink cannot leave or hop')
      if (t.hits) {
        if (f.active_state !== t.last.active_state) throw new Error('absorbing state changed')
        run.cost.total_es_calls += f.es_calls_increment; t.last = f; continue
      }
    }
    for (const c of candidateVisits(f, manifest.C_candidate ?? [])) if (!t.visited.has(c)) {
      t.visited.add(c); run.events.push({ id: `visit:${f.traj_id}:${c}`, type: 'visit', frame: f })
    }
    if (f.hop_event.occurred) {
      if (f.hop_event.from_state !== t.last.active_state) throw new Error('hop inconsistent with previous state')
      const event = { id: `hop:${f.traj_id}:${f.step}`, type: 'hop', frame: { ...f, channel_sink_id: null } }; run.events.push(event); t.history.push(event)
    } else if (f.active_state !== t.last.active_state) throw new Error('active state changed without hop record')
    if (f.channel_sink_id !== null && !t.hits) {
      run.events.push({ id: `hit:${f.traj_id}:${f.step}`, type: 'first_hit', frame: f, reactive_history: structuredClone(t.history) }); t.hits = true
    }
    run.cost.total_es_calls += f.es_calls_increment; t.last = f
  }
  let mass = 0
  for (const t of tracks.values()) {
    mass += t.last.weight
    if (!t.hits) {
      if (Math.abs(t.last.time_fs - manifest.horizon_fs) > 1e-10) throw new Error('incomplete direct history: censoring cannot be counted as survival to horizon')
      run.surviving_weight += t.last.weight
    }
  }
  if (Math.abs(mass - 1) >= 1e-12) throw new Error('direct root weights must sum to one')
  return run
}
export async function readTrajectoryRun(workspace, file) {
  if (!file.endsWith('.jsonl')) return readWorkspaceJSON(workspace, file)
  const root = await realpath(workspace), lexical = path.resolve(root, file)
  const check = target => { const r = path.relative(root, target); if (r === '..' || r.startsWith(`..${path.sep}`) || path.isAbsolute(r)) throw new Error('path escapes workspace') }
  check(lexical); const resolved = await realpath(lexical); check(resolved)
  const stream = createReadStream(resolved), lines = createInterface({ input: stream, crlfDelay: Infinity })
  async function* records() { for await (const line of lines) if (line.trim()) yield JSON.parse(line) }
  const iterator = records()
  try {
    const { value: header } = await iterator.next()
    if (header?.type !== 'manifest') throw new Error('JSONL first record must be type=manifest')
    return await directFramesToRun(iterator, header)
  } finally { lines.close(); stream.destroy() }
}
