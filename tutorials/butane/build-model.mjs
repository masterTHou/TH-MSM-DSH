// Reuse the production scientific core: no second MSM estimator in Python.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildClassicalModel, validateMSM, mfptToState } from '../../lib/msm/index.js'
const folder = path.resolve(process.argv[2] ?? 'output/butane-tutorial')
const input = JSON.parse(await readFile(path.join(folder, 'discrete-trajectories.json'), 'utf8'))
const settings = JSON.parse(await readFile(path.join(folder, 'simulation.json'), 'utf8'))
const lagFrames = Math.round(settings.msm_lag_ps / input.frame_time)
const model = buildClassicalModel(input, { lagFrames, holdoutFraction: 0.25 })
await writeFile(path.join(folder, 'model.json'), JSON.stringify(model, null, 2) + '\n')
await writeFile(path.join(folder, 'analysis.json'), JSON.stringify({ validation: validateMSM(model), mfpt: model.labels.map(s => mfptToState(model, s)) }, null, 2) + '\n')
const scan = []
for (const lag of [0.2, 0.5, 1, 2, 5]) {
  try {
    const m = buildClassicalModel(input, { lagFrames: Math.max(1, Math.round(lag / input.frame_time)), holdoutFraction: 0.25 })
    scan.push({ lag_ps: m.lag_time, verdict: validateMSM(m).verdict, timescales_ps: m.spectrum.map(s => s.decay_time), ck: m.validation.ck })
  } catch (error) { scan.push({ lag_ps: lag, error: error.message }) }
}
await writeFile(path.join(folder, 'lag-scan.json'), JSON.stringify(scan, null, 2) + '\n')
console.log(JSON.stringify({ lag_ps: model.lag_time, verdict: validateMSM(model).verdict, stationary_distribution: model.stationary_distribution }))
