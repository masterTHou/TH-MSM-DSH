import { fitMSM, validateDataset, type FitOptions } from './estimate.js'
import { assignFeatures, kmeans } from './features.js'
import { mfpt, requireStochastic, stationary, spectralModes } from './numerics.js'
import type { ClassicalDataset, FeatureDataset, MSMModel } from './types.js'
export { fitMSM, validateDataset, transitionCounts, normalizeCounts } from './estimate.js'
export { mfpt, stationary, spectralModes } from './numerics.js'
export { kmeans, assignFeatures } from './features.js'
export type { ClassicalDataset, FeatureDataset, MSMModel } from './types.js'
export { generateClassicalExample } from './example.js'

export interface BuildMSMOptions extends FitOptions { nClusters?: number; seed?: string; holdoutFraction?: number }
export function buildClassicalModel(input: unknown, options: BuildMSMOptions = {}): MSMModel {
  const fraction = options.holdoutFraction ?? 0.25
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 0.5) throw new Error('holdoutFraction must lie in [0,0.5)')
  if (!input || typeof input !== 'object') throw new Error('classical dataset object required')
  let dataset: ClassicalDataset, clustering: MSMModel['clustering']
  const raw = input as Partial<FeatureDataset>
  if (raw.kind === 'classical-features') {
    if (!Array.isArray(raw.feature_trajectories) || raw.feature_trajectories.some(t => !Array.isArray(t) || t.length < 2 || t.some(p => !Array.isArray(p)))) throw new Error('feature trajectories must preserve boundaries and contain at least two frames')
    const n = raw.feature_trajectories.length, heldout = n >= 4 ? Math.floor(n * fraction) : 0
    const training = raw.feature_trajectories.slice(0, n - heldout), validation = heldout ? raw.feature_trajectories.slice(n - heldout) : []
    const centers = kmeans(training, options.nClusters ?? 8, options.seed)
    for (const t of validation) for (const p of t) if (p.length !== centers[0].length || p.some(x => !Number.isFinite(x))) throw new Error('invalid held-out features')
    dataset = { kind: 'classical-trajectories', origin: raw.origin!, frame_time: raw.frame_time!, time_unit: raw.time_unit!, trajectories: assignFeatures(training, centers) }
    options = { ...options, validationTrajectories: assignFeatures(validation, centers) }
    clustering = { method: 'kmeans', centers, feature_dimension: centers[0].length, fit_on: 'training_only' }
  } else {
    validateDataset(input)
    const n = input.trajectories.length, heldout = options.validationTrajectories ? 0 : n >= 4 ? Math.floor(n * fraction) : 0
    dataset = { ...input, trajectories: input.trajectories.slice(0, n - heldout) }
    if (heldout) options = { ...options, validationTrajectories: input.trajectories.slice(n - heldout) }
  }
  const model = fitMSM(dataset, options)
  if (clustering) model.clustering = clustering
  return model
}
export function validateMSM(input: unknown): { ok: boolean; verdict: string; tests: { name: string; status: string; details: string }[]; uncertainties: string[] } {
  try {
    const model = input as MSMModel
    if (!model || model.kind !== 'classical-msm' || model.schema_version !== 1 || model.estimator !== 'nonreversible-row-mle' || !Array.isArray(model.labels) || model.labels.some(x => !Number.isSafeInteger(x) || x < 0) || new Set(model.labels).size !== model.labels.length || !Number.isFinite(model.lag_time) || model.lag_time <= 0 || !['steps', 'fs', 'ps', 'ns'].includes(model.time_unit) || !model.validation) throw new Error('unsupported classical MSM artifact')
    requireStochastic(model.transition_matrix)
    if (model.labels.length !== model.transition_matrix.length || model.counts.length !== model.labels.length || model.counts.some(r => r.length !== model.labels.length || r.some(x => !Number.isSafeInteger(x) || x < 0))) throw new Error('invalid count matrix or state mapping')
    model.counts.forEach((row, i) => { const sum = row.reduce((a, b) => a + b, 0); if (!sum || row.some((x, j) => Math.abs(x / sum - model.transition_matrix[i][j]) > 1e-10)) throw new Error('transition matrix inconsistent with counts') })
    const pi = stationary(model.transition_matrix), modes = spectralModes(model.transition_matrix, model.lag_time)
    if (!Array.isArray(model.stationary_distribution) || model.stationary_distribution.some(x => !Number.isFinite(x)) || pi.some((x, i) => Math.abs(x - model.stationary_distribution[i]) > 1e-9) || pi.length !== model.stationary_distribution.length) throw new Error('stationary distribution inconsistent')
    if (!Array.isArray(model.spectrum) || model.spectrum.length !== modes.length || modes.some((m, i) => {
      const saved = model.spectrum[i]
      return !saved?.eigenvalue || Math.abs(saved.eigenvalue.re - m.eigenvalue.re) > 1e-8 || Math.abs(saved.eigenvalue.im - m.eigenvalue.im) > 1e-8 || (m.decay_time === null ? saved.decay_time !== null : saved.decay_time === null || !Number.isFinite(saved.decay_time) || Math.abs(saved.decay_time - m.decay_time) > 1e-7 * Math.max(1, m.decay_time))
    })) throw new Error('saved spectrum inconsistent with transition matrix')
    const insufficient = !model.validation.ck.length || model.validation.ck.some(x => x.status === 'insufficient_data') || model.diagnostics.some(x => x.status === 'insufficient_data')
    const failed = modes.some(x => x.decay_time === null) || model.validation.ck.some(x => x.status === 'fail') || model.diagnostics.some(x => x.status === 'fail')
    const verdict = failed ? 'MARKOV_ASSUMPTION_UNSUPPORTED' : insufficient ? 'INSUFFICIENT_DATA' : 'SUPPORTED_AT_TESTED_LAGS'
    return { ok: !failed && !insufficient, verdict, tests: [{ name: 'matrix_and_stationary_consistency', status: 'pass', details: 'Recomputed from saved counts and transition matrix.' }, ...model.diagnostics, ...model.validation.ck.map(c => ({ name: `heldout_CK_${c.multiple}`, status: c.status, details: `weighted RMSE=${c.weighted_rmse}; supported rows=${c.supported_rows}; tolerance=${model.validation.ck_tolerance}` }))], uncertainties: ['CK and ITS are finite-data diagnostics; passing cannot prove Markovianity.', 'No reversible constraint, Bayesian posterior, PCCA+ or classical TPT is implemented.', 'Stationary populations describe this classical model, not photochemical branching ratios.'] }
  } catch (e) { return { ok: false, verdict: 'INVALID_MODEL', tests: [], uncertainties: [(e as Error).message] } }
}
export function mfptToState(model: MSMModel, targetLabel: number): { target_label: number; time_unit: string; by_state: { label: number; mean_time: number }[] } {
  const target = model.labels.indexOf(targetLabel)
  const times = mfpt(model.transition_matrix, target, model.lag_time)
  return { target_label: targetLabel, time_unit: model.time_unit, by_state: model.labels.map((label, i) => ({ label, mean_time: times[i] })) }
}
