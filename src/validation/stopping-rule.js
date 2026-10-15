import { summarize } from './benchmark.js'
// Analyze predeclared independent trials. Never stop because a favorable result appears.
export function evaluateEqualBudget(trials, { reference, referenceSE = 0, requiredRelativeSE = 0.25 } = {}) {
  if (!Array.isArray(trials) || !trials.length || !Number.isFinite(reference) || reference < 0 || reference > 1) throw new TypeError('trials and finite reference required')
  const methods = {}, grouped = new Map(), budgets = new Set(trials.map(t => t.total_es_calls))
  if (budgets.size !== 1 || !Number.isSafeInteger(trials[0].total_es_calls) || trials[0].total_es_calls <= 0) return { verdict: 'NOT_COMPARABLE', reason: 'Need identical positive measured total_es_calls including exploration; zero-ES toy models do not measure ES efficiency.' }
  for (const t of trials) {
    if (t.complete !== true || !t.run_id || !t.seed || !['direct', 'we', 'ci-we'].includes(t.mode)) return { verdict: 'INSUFFICIENT_DATA', reason: 'All predeclared trials must complete the same horizon; do not drop budget overruns/censored runs.' }
    if (!grouped.has(t.mode)) grouped.set(t.mode, [])
    grouped.get(t.mode).push(t)
  }
  if (new Set(trials.map(t => t.horizon_fs)).size !== 1 || !Number.isFinite(trials[0].horizon_fs) || trials[0].horizon_fs <= 0) throw new Error('invalid or different observation horizons')
  for (const mode of ['direct', 'we', 'ci-we']) {
    const group = grouped.get(mode)
    if (!group || group.length < 3 || new Set(group.map(t => t.seed)).size !== group.length || new Set(group.map(t => t.run_id)).size !== group.length) return { verdict: 'INSUFFICIENT_DATA', reason: 'At least three independent runs per mode required; more may be necessary for reliable variance.' }
    methods[mode] = summarize(group.map(t => ({ probability: t.probability, cost: t.total_es_calls })), reference, referenceSE)
    methods[mode].relative_SE = methods[mode].mean > 0 ? methods[mode].standard_error_of_mean / methods[mode].mean : null
  }
  const guided = methods['ci-we'], direct = methods.direct
  const enough = Object.values(methods).every(m => m.sampling_status === 'estimated' && m.variance > 0 && m.relative_SE <= requiredRelativeSE)
  return { verdict: !enough ? 'INSUFFICIENT_PRECISION' : guided.variance < direct.variance ? 'OBSERVED_VARIANCE_ADVANTAGE' : 'NO_EFFICIENCY_ADVANTAGE', methods, total_es_calls_per_trial: trials[0].total_es_calls, limitation: 'Observed sample variance is uncertain; this is not a guaranteed speedup or an optional-stopping confidence sequence.' }
}
