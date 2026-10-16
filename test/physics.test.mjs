import test from 'node:test'
import assert from 'node:assert/strict'
import { createLVC, createDualCI, runSimulation, buildC1, validateRun, PRNG, resample, CostLedger, validateFrame, assertMass } from '../lib/engine.js'
import { rescaleMomentum, kinetic, applyEDC, initialWalker, propagate } from '../lib/dynamics/fssh.js'
import { partition } from '../lib/analysis/partition.js'
import { directFramesToRun } from '../lib/io/trajectory.js'

test('analytic adiabatic gradients and NAC agree with finite differences', () => {
  for (const model of [createLVC(), createDualCI()]) {
    const R = [0.7, -0.4], d = model.evaluate(R), h = 1e-6
    for (let i = 0; i < 2; i++) {
      const plus = [...R], minus = [...R]; plus[i] += h; minus[i] -= h
      const a = model.evaluate(plus), b = model.evaluate(minus)
      for (let s = 0; s < 2; s++) assert.ok(Math.abs((a.energies[s] - b.energies[s]) / (2 * h) - d.gradients[s][i]) < 1e-9)
      const derivative = a.basis[1].map((x, j) => (x - b.basis[1][j]) / (2 * h))
      assert.ok(Math.abs(derivative.reduce((z, x, j) => z + x * d.basis[0][j], 0) - d.nac01[i]) < 1e-9)
    }
    for (const CI of model.intersections) assert.throws(() => model.evaluate(CI), /singularity/)
  }
})
test('hop rescaling conserves kinetic plus potential energy and rejects frustrated hop', () => {
  const masses = [2000, 2000], P = [10, 3], d = [0.4, 0.7]
  for (const de of [0.001, -0.02]) {
    const r = rescaleMomentum(P, masses, d, de)
    assert.equal(r.accepted, true)
    assert.ok(Math.abs(kinetic(r.P, masses) + de - kinetic(P, masses)) < 1e-13)
  }
  assert.equal(rescaleMomentum([0, 0], masses, d, 1).accepted, false)
})
test('EDC damps inactive amplitude and restores norm deterministically', () => {
  const c = [{ re: Math.sqrt(0.6), im: 0 }, { re: 0, im: Math.sqrt(0.4) }]
  const d = applyEDC(c, 0, 0.02, 0.01, 1)
  assert.ok(Math.abs(d[1].im) < Math.abs(c[1].im))
  assert.ok(Math.abs(d.reduce((s, z) => s + z.re ** 2 + z.im ** 2, 0) - 1) < 1e-14)
  assert.deepEqual(d, applyEDC(c, 0, 0.02, 0.01, 1))
})
test('PRNG snapshots replay and derived child streams differ', () => {
  const r = new PRNG('seed'); r.uniform(); const s = r.snapshot()
  assert.equal(r.uniform(), PRNG.restore(s).uniform())
  const m = createLVC(), parent = initialWalker(m, new PRNG('parent'), { id: 'p', weight: 1 })
  const split = resample([parent], { binOf: () => 'bin', target: 4, rng: new PRNG('scheduler'), epoch: 1 })
  assert.equal(split.walkers.length, 4)
  for (const w of split.walkers) {
    assert.deepEqual(w.frame.R_coords, parent.frame.R_coords); assert.deepEqual(w.frame.P_momenta, parent.frame.P_momenta)
    assert.deepEqual(w.frame.elec_amplitudes, parent.frame.elec_amplitudes); assert.equal(w.frame.active_state, parent.frame.active_state)
    assert.equal(w.weight, 0.25)
  }
  assert.equal(new Set(split.walkers.map(w => w.rng_state.seed)).size, 4)
  split.walkers[0].frame.R_coords[0]++
  assert.deepEqual(split.walkers[1].frame.R_coords, parent.frame.R_coords)
})
test('merge survivor frequency is weight proportional, not inverse weighted', () => {
  const m = createLVC(), a = initialWalker(m, new PRNG('a'), { id: 'a', weight: 0.2 }), b = initialWalker(m, new PRNG('b'), { id: 'b', weight: 0.8 }), rng = new PRNG('merge')
  let count = 0
  for (let i = 0; i < 2000; i++) {
    const out = resample([a, b], { binOf: () => 'one', target: 1, rng, epoch: i })
    assert.equal(out.walkers[0].weight, 1)
    if (out.events[0].selected_parent === 'a') count++
  }
  assert.ok(Math.abs(count / 2000 - 0.2) < 0.035)
})
test('ES ledger counts failed attempts and analytic calls separately', async () => {
  const l = new CostLedger()
  await assert.rejects(() => l.electronicStructure('exploration', () => { throw new Error('SCF failed') }), /SCF/)
  await l.electronicStructure('propagation', () => ({ energy: 1 }))
  l.analytic()
  assert.equal(l.total_es_calls, 2); assert.equal(l.model_evaluations, 1)
})
function syntheticRun() {
  const m = createLVC(), w = initialWalker(m, new PRNG('synthetic'), { id: 'parent', weight: 1 })
  const hop = { ...structuredClone(w.frame), time_fs: 1, step: 1, active_state: 0, hop_event: { occurred: true, from_state: 1, to_state: 0 } }
  const hitA = { ...structuredClone(hop), traj_id: 'a', parent_id: 'parent', time_fs: 2, step: 2, weight: 0.5, channel_sink_id: 'main', hop_event: { occurred: false, from_state: null, to_state: null } }
  const hitB = { ...structuredClone(hitA), traj_id: 'b', time_fs: 3 }
  return { schema_version: 1, run_id: 'synthetic', seed: 's1', horizon_fs: 4, observation_times_fs: [0, 1, 2, 3, 4], C_candidate: [{ id: 'candidate', label: 'C_candidate', center: hop.R_coords, radius: 0.5, gapThreshold: 1 }], cost: { total_es_calls: 7 }, surviving_weight: 0, events: [{ id: 'hop', type: 'hop', frame: hop }, ...[hitA, hitB].map((frame, i) => ({ id: `hit${i}`, type: 'first_hit', frame, reactive_history: [{ id: 'hop', frame: hop }] }))] }
}
test('C1 first-hit history is not multiplied when a hopped parent splits', () => {
  const run = syntheticRun(), a = buildC1(run)
  assert.deepEqual(a.curves[0].points.map(x => x.probability), [0, 0, 0.5, 1, 1])
  assert.equal(a.hopping_flux[0].weighted_count, 1)
  assert.equal(a.C_reactive[0].weighted_product_paths, 1)
  assert.deepEqual(a.C_reachable, ['candidate'])
  assert.equal(a.confidence_intervals.status, 'insufficient_independent_runs')
  const duplicate = structuredClone(run); duplicate.events.push(duplicate.events[0])
  assert.throws(() => buildC1(duplicate), /duplicate/)
  const mass = structuredClone(run); mass.surviving_weight = 0.1
  assert.throws(() => buildC1(mass), /mass/)
})
test('independent-run bootstrap rejects reuse and reports run-level intervals', () => {
  const run = syntheticRun(), other = structuredClone(run); other.run_id = 'other'; other.seed = 'other-seed'
  assert.throws(() => buildC1(run, { bootstrapRuns: [run] }), /independent/)
  const a = buildC1(run, { bootstrapRuns: [other], nBootstraps: 50 })
  assert.equal(a.confidence_intervals.unit, 'independent_complete_run')
  assert.equal(a.confidence_intervals.curves[0].points.at(-1).lower, 1)
})
test('schema rejects contradictory gap and unnormalized electronic amplitudes', () => {
  const f = syntheticRun().events[0].frame
  assert.throws(() => validateFrame({ ...f, delta_E_min: 5 }), /inconsistent/)
  assert.throws(() => validateFrame({ ...f, elec_amplitudes: [{ re: 2, im: 0 }, { re: 0, im: 0 }] }), /normalized/)
  assert.throws(() => partition(f, { widths: [0] }), /widths/)
  assert.throws(() => validateFrame({ ...f, hop_event: { occurred: false, from_state: 1, to_state: 0 } }), /non-hop/)
  assert.throws(() => assertMass([], NaN), /absorbed/)
  assert.throws(() => assertMass([{ weight: 1.1 }], -0.1), /absorbed/)
})
test('direct frame adapter handles simultaneous hop/absorption and counts exploration', async () => {
  const m = createLVC(), initial = initialWalker(m, new PRNG('frames'), { id: 'direct', weight: 1 }).frame
  const final = { ...structuredClone(initial), time_fs: 1, step: 1, active_state: 0, channel_sink_id: 'main', hop_event: { occurred: true, from_state: 1, to_state: 0 }, es_calls_increment: 3 }
  const manifest = { schema_version: 1, initialization: 'FC', mode: 'direct', run_id: 'frames', seed: 'frames', horizon_fs: 2, observation_times_fs: [0, 1, 2], exploration_es_calls: 7, protocol: { fc: { center: [-2, 0] } } }
  const run = await directFramesToRun([initial, final], manifest), a = buildC1(run)
  assert.equal(a.curves[0].points.at(-1).probability, 1); assert.equal(a.cost.total_es_calls, 10)
  assert.equal(a.hopping_flux[0].weighted_count, 1)
  await assert.rejects(() => directFramesToRun([initial], manifest), /incomplete/)
})
test('FC -> FSSH/EDC -> C1 -> validation closes for all three sampling modes', () => {
  for (const mode of ['direct', 'we', 'ci-we']) {
    const r = runSimulation({ mode, seed: 'e2e', nTrajectories: 12, steps: 1100, targetPerBin: 2, rareTargetPerBin: 3 })
    const a = buildC1(r)
    assert.ok(a.absorbed_weight > 0)
    assert.ok(Math.abs(a.absorbed_weight + a.surviving_weight - 1) < 1e-12)
    assert.equal(r.cost.total_es_calls, 0); assert.ok(r.cost.model_evaluations > 0)
    assert.equal(validateRun(r).ok, true)
    if (mode !== 'direct') assert.ok(r.resampling.length > 0)
  }
})
test('checkpoint restart reproduces propagation and timestep refinement improves energy', () => {
  const m = createLVC(), w = initialWalker(m, new PRNG('replay'), { id: 'replay', weight: 1 }), copy = structuredClone(w)
  propagate(w, m); propagate(copy, m); assert.deepEqual(copy, w)
  // Same smooth, noncrossing initial ensemble, half timestep at identical horizon.
  const coarse = runSimulation({ seed: 'dt', nTrajectories: 8, dt: 2, steps: 40, edc: false })
  const fine = runSimulation({ seed: 'dt', nTrajectories: 8, dt: 1, steps: 80, edc: false })
  assert.ok(fine.diagnostics.max_energy_drift_hartree < coarse.diagnostics.max_energy_drift_hartree / 2)
})
