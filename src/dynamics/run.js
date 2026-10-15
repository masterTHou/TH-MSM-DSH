import { createLVC } from '../models/lvc-2d.js'
import { createDualCI } from '../models/dual-ci-2d.js'
import { CostLedger } from '../core/cost-ledger.js'
import { AU_TIME_FS, assertMass } from '../core/frame.js'
import { PRNG, deriveSeed } from '../sampling/prng.js'
import { initialWalker, propagate } from './fssh.js'
import { partition, candidateVisits } from '../analysis/partition.js'
import { resample } from '../sampling/resample.js'

export function runSimulation(options = {}) {
  const { mode = 'direct', seed = 'run-1', nTrajectories = 64, steps = 800, dt = 0.5, resampleEvery = 50, targetPerBin = 4, rareTargetPerBin = 8, recordFrames = false } = options
  if (!['direct', 'we', 'ci-we'].includes(mode) || (options.model !== undefined && !['lvc', 'dual-ci'].includes(options.model)) || typeof seed !== 'string' || !seed || !Number.isInteger(nTrajectories) || nTrajectories < 1 || !Number.isInteger(steps) || steps < 1 || !Number.isInteger(resampleEvery) || resampleEvery < 1 || !Number.isFinite(dt) || dt <= 0) throw new RangeError('invalid simulation configuration')
  const model = options.model === 'dual-ci' ? createDualCI(options.modelParameters) : createLVC(options.modelParameters)
  const ledger = new CostLedger(), fc = options.fc ?? { center: [-2, model.name.startsWith('extended') ? -1 : 0] }, bins = options.bins ?? { widths: [0.75, 0.5], gapThreshold: 0.04 }
  const candidates = options.candidates ?? model.intersections.map((center, i) => ({ id: `CI-${i}`, label: 'C_candidate', center, radius: 0.65, gapThreshold: 0.04 }))
  const sinkX = options.sinkX ?? 0.8
  if (!Number.isFinite(sinkX) || sinkX <= 0) throw new RangeError('invalid sink boundary')
  const protocol = { model: model.name, model_parameters: model.parameters, fc, dt_au: dt, steps, edc: options.edc ?? true, edc_C_hartree: options.edcC ?? 0.1, electronic_substeps: options.electronicSubsteps ?? 4, sink: { active_state: 0, x_greater_than: sinkX, channels: 'y<=0:main; y>0:rare' }, bins, C_candidate: candidates, sampling: { mode, nTrajectories, resampleEvery, targetPerBin, rareTargetPerBin }, adaptive: 'halve nuclear timestep on probability overflow, minimum dt/65536' }
  const run = { schema_version: 1, run_id: deriveSeed(seed, mode, protocol, nTrajectories), seed, mode, protocol, units: { R: 'bohr', P: 'atomic', energy: 'hartree', time: 'fs' }, horizon_fs: steps * dt * AU_TIME_FS, observation_times_fs: Array.from({ length: 11 }, (_, i) => i * steps * dt * AU_TIME_FS / 10), sinks: ['main', 'rare'], C_candidate: candidates, events: [], resampling: [], frames: [], initial_states: [], diagnostics: { max_energy_drift_hartree: 0, max_norm_error: 0, frustrated_hops: 0, propagation_steps: 0, weight_checks: 0, edc_enabled: options.edc ?? true }, surviving_weight: 1 }
  let walkers = Array.from({ length: nTrajectories }, (_, i) => initialWalker(model, new PRNG(deriveSeed(seed, 'FC', i)), { id: `fc:${i}`, weight: 1 / nTrajectories, fc, ledger }))
  run.initial_states = walkers.map(w => structuredClone(w.frame))
  const scheduler = new PRNG(deriveSeed(seed, 'scheduler')), visits = new Set()
  let absorbed = 0
  const recordVisits = w => {
    for (const c of candidateVisits(w.frame, candidates)) {
      const key = `${w.frame.traj_id}:${c}`
      if (!visits.has(key)) { visits.add(key); run.events.push({ id: `visit:${key}`, type: 'visit', frame: structuredClone(w.frame) }) }
    }
  }
  for (const w of walkers) recordVisits(w)
  for (let step = 1; step <= steps; step++) {
    const live = []
    for (const w of walkers) {
      const boundary = step * dt * AU_TIME_FS
      let localDt = dt
      while (w.frame.time_fs < boundary - 1e-12) {
      localDt = Math.min(localDt, (boundary - w.frame.time_fs) / AU_TIME_FS)
      let d
      try { d = propagate(w, model, { dt: localDt, electronicSubsteps: protocol.electronic_substeps, edc: protocol.edc, edcC: protocol.edc_C_hartree, ledger }) }
      catch (e) {
        if (!e.message.startsWith('FSSH probability >1') || localDt <= dt / 65536) throw e
        localDt /= 2; run.diagnostics.adaptive_retries = (run.diagnostics.adaptive_retries ?? 0) + 1; continue
      }
      if (Math.abs(w.frame.time_fs - boundary) < 1e-12) w.frame.time_fs = boundary
      run.diagnostics.propagation_steps++
      run.diagnostics.max_energy_drift_hartree = Math.max(run.diagnostics.max_energy_drift_hartree, Math.abs(d.energy - w.initial_energy))
      run.diagnostics.max_norm_error = Math.max(run.diagnostics.max_norm_error, d.norm_error)
      if (d.frustrated) run.diagnostics.frustrated_hops++
      recordVisits(w)
      if (w.frame.hop_event.occurred) {
        const event = { id: `hop:${w.frame.traj_id}:${w.frame.step}`, type: 'hop', frame: structuredClone(w.frame) }
        run.events.push(event); w.reactive_history.push(event)
      }
      if (w.frame.active_state === 0 && w.frame.R_coords[0] > sinkX) {
        w.frame.channel_sink_id = w.frame.R_coords[1] > 0 ? 'rare' : 'main'
        run.events.push({ id: `hit:${w.frame.traj_id}:${w.frame.step}`, type: 'first_hit', frame: structuredClone(w.frame), reactive_history: structuredClone(w.reactive_history) })
        absorbed += w.weight
      }
      if (recordFrames) run.frames.push(structuredClone(w.frame))
      if (w.frame.channel_sink_id !== null) break
      }
      if (w.frame.channel_sink_id === null) live.push(w)
    }
    walkers = live
    if (mode !== 'direct' && step % resampleEvery === 0 && step < steps && walkers.length) {
      const result = resample(walkers, { binOf: f => {
        const bin = partition(f, bins)
        return mode === 'ci-we' ? `${bin}|candidate:${candidateVisits(f, candidates).join(',') || 'none'}` : bin
      }, target: bin => mode === 'ci-we' && !bin.endsWith('candidate:none') ? rareTargetPerBin : targetPerBin, rng: scheduler, epoch: step, absorbed, maxWalkers: options.maxWalkers ?? 10000 })
      walkers = result.walkers; run.resampling.push(...result.events)
    }
    assertMass(walkers, absorbed); run.diagnostics.weight_checks++
  }
  run.surviving_weight = walkers.reduce((s, w) => s + w.weight, 0)
  run.final_checkpoints = walkers.map(w => structuredClone(w))
  run.cost = ledger.snapshot()
  return run
}
