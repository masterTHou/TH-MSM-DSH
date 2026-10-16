import { mfpt, requireStochastic, stationary, spectralModes } from './numerics.js'
import type { MSMModel } from './types.js'
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
