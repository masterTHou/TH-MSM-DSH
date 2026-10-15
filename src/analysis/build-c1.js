import { validateFrame } from '../core/frame.js'
import { partition, candidateVisits } from './partition.js'
import { PRNG } from '../sampling/prng.js'

// A run is an event ledger, not a concatenation of final leaf histories.
export function buildC1(run, { times = run.observation_times_fs, bins = run.protocol?.bins ?? {}, bootstrapRuns = [], nBootstraps = 200, confidence = 0.95, seed = 'bootstrap' } = {}) {
  if (run.schema_version !== 1 || !run.run_id || !Number.isFinite(run.horizon_fs) || run.horizon_fs <= 0) throw new TypeError('versioned run/horizon required')
  if (!Array.isArray(times) || !times.length || times.some((t, i) => !Number.isFinite(t) || t < 0 || t > run.horizon_fs || (i && t <= times[i - 1]))) throw new RangeError('invalid observation times')
  if (!run.cost || !Number.isSafeInteger(run.cost.total_es_calls) || run.cost.total_es_calls < 0) throw new TypeError('cost ledger required')
  if (!Array.isArray(run.events)) throw new TypeError('event ledger required; use direct-frame adapter for raw direct trajectories')
  const flux = new Map(), reached = new Set(), reactive = new Map(), firstHits = new Map(), eventIds = new Set()
  const channels = new Set(run.sinks ?? [])
  const hopEvidence = new Map((run.events ?? []).filter(e => e.type === 'hop').map(e => [e.id, e.frame]))
  for (const event of run.events ?? []) {
    if (!event.id || eventIds.has(event.id)) throw new Error('missing or duplicate event ID')
    eventIds.add(event.id)
    const f = validateFrame(event.frame)
    if (f.time_fs > run.horizon_fs) throw new RangeError('event beyond horizon')
    const visits = candidateVisits(f, run.C_candidate ?? [])
    visits.forEach(id => reached.add(id))
    if (event.type === 'visit') continue
    if (event.type === 'hop') {
      if (!f.hop_event.occurred || f.channel_sink_id !== null) throw new Error('hop event inconsistent')
      const key = `${partition(f, bins)}|${f.hop_event.from_state}->${f.hop_event.to_state}`
      const row = flux.get(key) ?? { bin: partition(f, bins), from_state: f.hop_event.from_state, to_state: f.hop_event.to_state, weighted_count: 0, events: 0 }
      row.weighted_count += f.weight; row.events++; flux.set(key, row)
    } else if (event.type === 'first_hit') {
      if (f.channel_sink_id === null || firstHits.has(f.traj_id)) throw new Error('duplicate first hit or missing sink')
      channels.add(f.channel_sink_id); firstHits.set(f.traj_id, event)
      for (const h of event.reactive_history ?? []) {
        // Historical frames are evidence only: never count their weights as new hops.
        validateFrame(h.frame)
        if (!h.frame.hop_event.occurred || h.frame.time_fs > f.time_fs || JSON.stringify(hopEvidence.get(h.id)) !== JSON.stringify(h.frame)) throw new Error('invalid or unrecorded reactive hop history')
        for (const id of candidateVisits(h.frame, run.C_candidate ?? [])) {
          reached.add(id)
          const key = `${id}|${f.channel_sink_id}`, entry = reactive.get(key) ?? { candidate_id: id, sink_id: f.channel_sink_id, weighted_product_paths: 0, hop_evidence_ids: new Set() }
          // A candidate contributes once per absorbed path, even if it contains several hops.
          if (!entry.hop_evidence_ids.has(event.id)) { entry.weighted_product_paths += f.weight; entry.hop_evidence_ids.add(event.id) }
          reactive.set(key, entry)
        }
      }
    } else throw new Error(`unknown event type: ${event.type}`)
  }
  const hits = [...firstHits.values()]
  const curves = [...channels].sort().map(channel => ({ channel, points: times.map(time_fs => ({ time_fs, probability: hits.filter(e => e.frame.channel_sink_id === channel && e.frame.time_fs <= time_fs).reduce((a, e) => a + e.frame.weight, 0) })) }))
  const absorbed = hits.reduce((a, e) => a + e.frame.weight, 0)
  if (!Number.isFinite(run.surviving_weight) || run.surviving_weight < 0 || Math.abs(absorbed + run.surviving_weight - 1) >= 1e-12) throw new Error('final absorbed + surviving mass must equal one')
  const result = { schema_version: 1, mode: 'c1', run_id: run.run_id, horizon_fs: run.horizon_fs, curves, hopping_flux: [...flux.values()].map(x => ({ ...x, weighted_events_per_fs: x.weighted_count / run.horizon_fs })), C_candidate: run.C_candidate ?? [], C_reachable: [...reached].sort(), C_reactive: [...reactive.values()].map(({ hop_evidence_ids, ...x }) => ({ ...x, first_hit_evidence_ids: [...hop_evidence_ids] })), absorbed_weight: absorbed, surviving_weight: run.surviving_weight, cost: run.cost, confidence_intervals: { status: 'insufficient_independent_runs' } }
  if (bootstrapRuns.length) {
    const runs = [run, ...bootstrapRuns]
    if (new Set(runs.map(r => r.run_id)).size !== runs.length || new Set(runs.map(r => r.seed)).size !== runs.length || runs.some(r => !r.seed || r.horizon_fs !== run.horizon_fs || JSON.stringify(r.protocol) !== JSON.stringify(run.protocol))) throw new Error('bootstrap needs independent runs of the same protocol and horizon')
    if (!Number.isInteger(nBootstraps) || nBootstraps < 20 || !(confidence > 0 && confidence < 1)) throw new RangeError('invalid bootstrap parameters')
    const estimates = runs.map(r => buildC1(r, { times }).curves), rng = new PRNG(seed)
    result.confidence_intervals = { status: 'estimated', unit: 'independent_complete_run', independent_runs: runs.length, confidence, curves: curves.map(c => ({ channel: c.channel, points: c.points.map((p, j) => {
      const samples = Array.from({ length: nBootstraps }, () => Array.from({ length: runs.length }, () => estimates[Math.floor(rng.uniform() * runs.length)].find(x => x.channel === c.channel)?.points[j].probability ?? 0).reduce((a, b) => a + b, 0) / runs.length).sort((a, b) => a - b)
      const mean = estimates.reduce((a, e) => a + (e.find(x => x.channel === c.channel)?.points[j].probability ?? 0), 0) / runs.length
      return { time_fs: p.time_fs, mean, lower: samples[Math.floor((1 - confidence) / 2 * nBootstraps)], upper: samples[Math.min(nBootstraps - 1, Math.floor((1 + confidence) / 2 * nBootstraps))] }
    }) })) }
  }
  return result
}
