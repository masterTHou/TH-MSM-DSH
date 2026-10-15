export function summarize(estimates, reference, referenceSE = 0) {
  if (!Number.isFinite(reference) || reference < 0 || reference > 1 || !Number.isFinite(referenceSE) || referenceSE < 0) throw new RangeError('invalid reference estimate')
  if (estimates.length < 2 || estimates.some(x => !Number.isFinite(x.probability) || x.probability < 0 || x.probability > 1 || !(x.cost > 0))) throw new Error('at least two independent complete runs with measured cost required')
  const n = estimates.length, mean = estimates.reduce((s, x) => s + x.probability, 0) / n
  const variance = estimates.reduce((s, x) => s + (x.probability - mean) ** 2, 0) / (n - 1), meanCost = estimates.reduce((s, x) => s + x.cost, 0) / n
  return { independent_runs: n, mean, standard_error_of_mean: Math.sqrt(variance / n), variance, relative_variance: mean > 0 ? variance / mean ** 2 : null, rmse_against_finite_reference: Math.sqrt(estimates.reduce((s, x) => s + (x.probability - reference) ** 2, 0) / n), reference_standard_error: referenceSE, mean_model_evaluations: meanCost, total_model_evaluations: meanCost * n, cost_times_variance: meanCost * variance, sampling_status: estimates.every(x => x.probability === 0) ? 'zero_hits_insufficient_evidence' : 'estimated' }
}
export function compareEfficiency(methods) {
  const direct = methods.direct
  const results = {}
  for (const mode of ['we', 'ci-we']) {
    const m = methods[mode], insufficient = !m || !direct || m.sampling_status !== 'estimated' || direct.sampling_status !== 'estimated' || m.variance === 0 || direct.variance === 0
    results[mode] = insufficient ? { verdict: 'INSUFFICIENT_EVIDENCE', speedup: null } : {
      verdict: m.cost_times_variance < direct.cost_times_variance ? 'PILOT_COST_NORMALIZED_ADVANTAGE' : 'NO_EFFICIENCY_ADVANTAGE',
      cost_normalized_variance_ratio: m.cost_times_variance / direct.cost_times_variance,
      speedup: null,
      limitation: 'Measured analytical costs differ. This is a pilot efficiency diagnostic, not an equal-ES-budget acceleration claim.',
    }
  }
  return results
}
export function wilsonInterval(hits, n, z = 1.959963984540054) {
  if (!Number.isInteger(n) || n < 1 || !Number.isInteger(hits) || hits < 0 || hits > n) throw new RangeError('invalid binomial counts')
  const p = hits / n, d = 1 + z * z / n, center = (p + z * z / (2 * n)) / d, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
  return [Math.max(0, center - half), Math.min(1, center + half)]
}
