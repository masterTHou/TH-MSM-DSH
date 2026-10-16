import { createHash } from 'node:crypto'
import { requireStochastic, stationary, spectralModes, matrixPower } from './numerics.js'
import type { ClassicalDataset, MSMModel } from './types.js'
export function validateDataset(input: unknown): asserts input is ClassicalDataset {
  if (!input || typeof input !== 'object') throw new Error('dataset required')
  const d = input as Partial<ClassicalDataset>
  if (d.kind !== 'classical-trajectories' || !['unbiased-md', 'synthetic-markov'].includes(d.origin ?? '') || !Number.isFinite(d.frame_time) || !(d.frame_time! > 0) || !['steps', 'fs', 'ps', 'ns'].includes(d.time_unit ?? '')) throw new Error('explicit classical dataset kind/origin/frame_time/time_unit required; WE and photochemical data require C1')
  if (!Array.isArray(d.trajectories) || !d.trajectories.length || d.trajectories.some(t => !Array.isArray(t) || t.length < 2 || t.some(s => !Number.isSafeInteger(s) || s < 0))) throw new Error('nonnegative discrete labels, at least two frames per trajectory required')
}
export function transitionCounts(trajs: number[][], lag: number, labels: number[]): number[][] {
  if (!Number.isInteger(lag) || lag < 1) throw new Error('lag_frames must be a positive integer')
  const index = new Map(labels.map((label, i) => [label, i])), C = labels.map(() => labels.map(() => 0))
  for (const t of trajs) {
    if (t.some(s => !index.has(s))) throw new Error('validation trajectory contains a state unseen in training')
    for (let i = 0; i + lag < t.length; i++) C[index.get(t[i])!][index.get(t[i + lag])!]++
  }
  return C
}
export function normalizeCounts(C: number[][]): number[][] {
  return C.map((row, i) => { const sum = row.reduce((a, b) => a + b, 0); if (!sum) throw new Error(`no outgoing observations for state index ${i} at this lag; no absorbing row invented`); return row.map(x => x / sum) })
}
export interface FitOptions { lagFrames?: number; itsLags?: number[]; ckMultiples?: number[]; validationTrajectories?: number[][]; ckTolerance?: number; minCountsPerRow?: number }
export function fitMSM(dataset: ClassicalDataset, options: FitOptions = {}): MSMModel {
  validateDataset(dataset)
  const lag = options.lagFrames ?? 1, tolerance = options.ckTolerance ?? 0.1, minCounts = options.minCountsPerRow ?? 20
  if (!(tolerance > 0 && tolerance < 1) || !Number.isInteger(minCounts) || minCounts < 1) throw new Error('invalid CK tolerance/support threshold')
  const labels = [...new Set(dataset.trajectories.flat())].sort((a, b) => a - b)
  if (labels.length < 2 || labels.length > 128) throw new Error('basic dense MSM supports 2–128 observed states')
  const C = transitionCounts(dataset.trajectories, lag, labels), P = normalizeCounts(C)
  requireStochastic(P)
  const pi = stationary(P), lagTime = lag * dataset.frame_time, spectrum = spectralModes(P, lagTime)
  const lags = [...new Set(options.itsLags ?? [lag, 2 * lag, 3 * lag])].sort((a, b) => a - b)
  const its: MSMModel['validation']['its'] = lags.map(l => {
    try { return { lag_frames: l, modes: spectralModes(normalizeCounts(transitionCounts(dataset.trajectories, l, labels)), l * dataset.frame_time) } }
    catch (e) { return { lag_frames: l, modes: [], error: (e as Error).message } }
  })
  const validation = options.validationTrajectories ?? []
  if (validation.length) validateDataset({ ...dataset, trajectories: validation })
  const ck: MSMModel['validation']['ck'] = (options.ckMultiples ?? [2, 3]).map(multiple => {
    if (!Number.isInteger(multiple) || multiple < 2 || multiple > 100) throw new Error('CK multiples must be integers 2–100')
    if (!validation.length) return { multiple, weighted_rmse: null, supported_rows: 0, status: 'insufficient_data' }
    const empirical = transitionCounts(validation, multiple * lag, labels), predicted = matrixPower(P, multiple)
    let squared = 0, total = 0, supported = 0
    empirical.forEach((row, i) => {
      const count = row.reduce((a, b) => a + b, 0)
      if (count < minCounts) return
      supported++; total += count
      squared += count * row.reduce((s, value, j) => s + (value / count - predicted[i][j]) ** 2, 0) / labels.length
    })
    const rmse = total ? Math.sqrt(squared / total) : null
    return { multiple, weighted_rmse: rmse, supported_rows: supported, status: supported !== labels.length ? 'insufficient_data' : rmse! <= tolerance ? 'pass' : 'fail' }
  })
  const diagnostics: MSMModel['diagnostics'] = [{ name: 'row_stochasticity', status: 'pass', details: 'Rows normalized from within-trajectory sliding lag counts; no cross-trajectory transitions.' }, { name: 'irreducibility', status: 'pass', details: 'All retained states mutually reachable; no silent component deletion.' }]
  const validITS = its.filter(x => !x.error && x.modes[0]?.decay_time !== null && x.modes[0]?.decay_time !== undefined)
  const scales = validITS.map(x => x.modes[0].decay_time!)
  const stable = scales.length >= 3 && Math.max(...scales) > 0 && (Math.max(...scales) - Math.min(...scales)) / Math.max(...scales) < 0.3
  diagnostics.push({ name: 'slowest_ITS_spread', status: scales.length < 3 ? 'insufficient_data' : stable ? 'pass' : 'fail', details: 'Heuristic: slowest decay-time spread <30% across at least three lags. Modes may exchange; inspect spectra, not only this flag.' })
  if (its.some(x => x.error)) diagnostics.push({ name: 'lag_model_support', status: 'insufficient_data', details: 'Some requested ITS lag models could not be estimated; inspect per-lag errors.' })
  if (spectrum.some(s => s.decay_time === null)) diagnostics.push({ name: 'nondecaying_modes', status: 'fail', details: 'Unit-modulus nonstationary mode: periodicity/nondecay; no finite relaxation time claimed.' })
  const verdict = diagnostics.some(x => x.status === 'fail') || ck.some(x => x.status === 'fail') ? 'MARKOV_ASSUMPTION_UNSUPPORTED' : diagnostics.some(x => x.status === 'insufficient_data') || !ck.length || ck.some(x => x.status === 'insufficient_data') ? 'INSUFFICIENT_DATA' : 'SUPPORTED_AT_TESTED_LAGS'
  return { schema_version: 1, kind: 'classical-msm', estimator: 'nonreversible-row-mle', labels, lag_frames: lag, lag_time: lagTime, time_unit: dataset.time_unit, counts: C, transition_matrix: P, stationary_distribution: pi, spectrum, diagnostics, validation: { verdict, its, ck, ck_tolerance: tolerance, min_counts_per_row: minCounts, validation_trajectories: validation.length }, provenance: { data_digest: createHash('sha256').update(JSON.stringify({ dataset, validation })).digest('hex'), training_trajectories: dataset.trajectories.length, validation_trajectories: validation.length, origin: dataset.origin } }
}
