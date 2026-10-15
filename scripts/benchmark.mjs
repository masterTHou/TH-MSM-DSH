import { mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { runSimulation, buildC1, validateRun } from '../src/engine.js'
import { summarize, compareEfficiency, wilsonInterval } from '../src/validation/benchmark.js'

const full = process.argv.includes('--full')
const profile = process.argv.includes('--profile=pilot-v1') ? 'pilot-v1' : 'target-v2'
const seedPrefix = profile === 'pilot-v1' ? '' : `${profile}-`
const output = process.argv.find(x => x.startsWith('--output='))?.slice(9) ?? 'output/benchmark'
await mkdir(output, { recursive: true })
// Calibration used seed calibration2, N=256. All reported seeds below are independent of it.
const frozen = { model: 'dual-ci', fc: { center: [-2, profile === 'pilot-v1' ? 0 : -0.15], omega: 0.001 }, dt: 0.5, steps: 1100, targetPerBin: 4, rareTargetPerBin: 8, resampleEvery: 50 }
const referenceN = full ? 10000 : 128, replicates = full ? 20 : 3
const ref = { rareHits: 0, mainHits: 0, cost: 0, survivingWeight: 0, worstEnergyDrift: 0 }
const start = performance.now()
// Batch independent direct roots; keep full per-batch event records on disk.
for (let offset = 0; offset < referenceN; offset += 100) {
  const n = Math.min(100, referenceN - offset)
  const run = runSimulation({ ...frozen, mode: 'direct', seed: `${seedPrefix}reference-v1.3-independent-batch-${offset}`, nTrajectories: n })
  const validation = validateRun(run)
  if (!validation.ok) throw new Error(`reference validation failed: ${JSON.stringify(validation)}`)
  const analysis = buildC1(run)
  ref.rareHits += run.events.filter(x => x.type === 'first_hit' && x.frame.channel_sink_id === 'rare').length
  ref.mainHits += run.events.filter(x => x.type === 'first_hit' && x.frame.channel_sink_id === 'main').length
  ref.survivingWeight += analysis.surviving_weight * n / referenceN
  ref.cost += run.cost.model_evaluations
  ref.worstEnergyDrift = Math.max(ref.worstEnergyDrift, run.diagnostics.max_energy_drift_hartree)
  await writeFile(`${output}/reference-${offset}.json`, JSON.stringify(run))
  console.log(`reference ${offset + n}/${referenceN}; rare hits=${ref.rareHits}`)
}
const reference = { ...ref, n: referenceN, probability: ref.rareHits / referenceN, interval_95: wilsonInterval(ref.rareHits, referenceN), standard_error: Math.sqrt((ref.rareHits / referenceN) * (1 - ref.rareHits / referenceN) / referenceN), description: 'Finite direct-FSSH+EDC reference estimate; not exact quantum ground truth' }
const methods = {}, estimates = {}, independentRuns = {}
for (const mode of ['direct', 'we', 'ci-we']) {
  estimates[mode] = []; independentRuns[mode] = []
  for (let i = 0; i < replicates; i++) {
    const run = runSimulation({ ...frozen, mode, seed: `${seedPrefix}evaluation-v1.3-${i}`, nTrajectories: 64 })
    const validation = validateRun(run)
    if (!validation.ok) throw new Error(`${mode} validation failed: ${JSON.stringify(validation)}`)
    const analysis = buildC1(run), probability = analysis.curves.find(c => c.channel === 'rare').points.at(-1).probability
    estimates[mode].push({ probability, cost: run.cost.model_evaluations, total_es_calls: run.cost.total_es_calls })
    independentRuns[mode].push(run)
    await writeFile(`${output}/${mode}-${i}.json`, JSON.stringify(run))
    console.log(`${mode} ${i + 1}/${replicates}: r_rare=${probability}; evaluations=${run.cost.model_evaluations}`)
  }
  methods[mode] = summarize(estimates[mode], reference.probability, reference.standard_error)
  const ci = buildC1(independentRuns[mode][0], { bootstrapRuns: independentRuns[mode].slice(1), nBootstraps: full ? 1000 : 100 })
  methods[mode].bootstrap_95 = ci.confidence_intervals.curves.find(c => c.channel === 'rare').points.at(-1)
  const combinedSE = Math.hypot(methods[mode].standard_error_of_mean, reference.standard_error)
  methods[mode].reference_agreement_z = combinedSE > 0 ? Math.abs(methods[mode].mean - reference.probability) / combinedSE : null
  methods[mode].agreement_verdict = methods[mode].reference_agreement_z === null ? 'INSUFFICIENT_DATA' : methods[mode].reference_agreement_z <= 3 ? 'NO_DISAGREEMENT_DETECTED_AT_3SE' : 'DISAGREEMENT_REQUIRES_INVESTIGATION'
  await writeFile(`${output}/${mode}-c1.json`, JSON.stringify(ci, null, 2))
}
const result = { version: '1.3.0', profile, full, frozen_parameters: frozen, reference, methods, estimates, efficiency: compareEfficiency(methods), total_es_calls: 0, elapsed_seconds: (performance.now() - start) / 1000, limitations: ['Analytical evaluations are measured, ES calls are zero. No ES cost saving is claimed.', 'This pilot compares measured cost-normalized variance; strict equal-budget stopping is not implemented.', 'Absorbing boundaries label toy-model products; molecular dissociation is not established.', 'Finite reference, numerical discretization, FSSH and EDC carry uncertainties. Agreement cannot prove unbiasedness.', 'C2/ITS/CK and external ES interfaces remain unsupported.'] }
await writeFile(`${output}/summary.json`, JSON.stringify(result, null, 2))
await writeFile(`${output}/REPORT.md`, `# Nonadiabatic benchmark v1.3.0\n\nReference: ${reference.probability} (95% Wilson: ${reference.interval_95.join(' – ')}), N=${referenceN}.\n\n| Method | Mean rare first-hit | Variance | Relative variance | RMSE vs finite reference | Mean model evaluations |\n|---|---:|---:|---:|---:|---:|\n${Object.entries(methods).map(([m, x]) => `| ${m} | ${x.mean} | ${x.variance} | ${x.relative_variance} | ${x.rmse_against_finite_reference} | ${x.mean_model_evaluations} |`).join('\n')}\n\nEfficiency diagnostic:\n\n${JSON.stringify(result.efficiency, null, 2)}\n\n${result.limitations.map(x => `- ${x}`).join('\n')}\n`)
console.log(`Saved ${output}/summary.json`)
