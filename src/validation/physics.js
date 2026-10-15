import { buildC1 } from '../analysis/build-c1.js'
import { validateFrame } from '../core/frame.js'
export function validateRun(run, { energyTolerance = 1e-4, normTolerance = 1e-8 } = {}) {
  if (![energyTolerance, normTolerance].every(x => Number.isFinite(x) && x > 0)) throw new RangeError('validation tolerances must be finite and positive')
  const tests = [], uncertainties = []
  function check(name, fn) {
    try { const details = fn(); tests.push({ name, status: 'pass', details }) }
    catch (e) { tests.push({ name, status: 'fail', details: e.message }) }
  }
  check('weighted_first_hit_and_final_mass', () => { buildC1(run); return 'absorbed + surviving weight equals one; event IDs and first-hit uniqueness checked' })
  check('FC_and_checkpoint_schema', () => {
    if (!run.initial_states?.length || !run.protocol?.fc || run.units?.energy !== 'hartree') throw new Error('FC provenance/atomic units missing')
    let sum = 0
    for (const f of run.initial_states) { validateFrame(f); if (f.parent_id !== null || f.step !== 0 || f.time_fs !== 0 || f.channel_sink_id !== null) throw new Error('invalid FC root'); sum += f.weight }
    if (Math.abs(sum - 1) >= 1e-12) throw new Error('initial weights must equal one')
    for (const w of run.final_checkpoints ?? []) validateFrame(w.frame)
    return 'FC initial records and available final checkpoints valid'
  })
  const diagnostics = run.diagnostics
  for (const [name, key, tolerance] of [['energy_drift', 'max_energy_drift_hartree', energyTolerance], ['electronic_norm', 'max_norm_error', normTolerance]]) {
    if (!diagnostics || !Number.isFinite(diagnostics[key])) { tests.push({ name, status: 'not_run', details: 'step diagnostics missing' }); continue }
    check(name, () => { if (diagnostics[key] > tolerance) throw new Error(`${key}=${diagnostics[key]} exceeds ${tolerance}`); return `${key}=${diagnostics[key]}; tolerance=${tolerance}` })
  }
  if (diagnostics && typeof diagnostics.edc_enabled === 'boolean' && typeof run.protocol?.edc === 'boolean' && diagnostics.edc_enabled === run.protocol.edc) {
    check('decoherence_configuration', () => { if (!Number.isFinite(run.protocol.edc_C_hartree) || run.protocol.edc_C_hartree < 0) throw new Error('invalid EDC parameter'); return `energy-based deterministic correction: ${diagnostics.edc_enabled ? 'enabled' : 'disabled'}; algorithm correctness tested separately` })
  } else tests.push({ name: 'decoherence_configuration', status: 'not_run', details: 'missing or inconsistent EDC metadata' })
  tests.push({ name: 'ITS_and_CK', status: 'not_run', details: 'C2 not implemented in this release; use C1 only' })
  uncertainties.push('FSSH+EDC is approximate dynamics; WE unbiasedness is relative to this same propagator.', 'Single WE run does not support independent-walker bootstrap.', 'Numerical convergence requires a timestep study; these diagnostics alone do not establish it.')
  const failed = tests.some(t => t.status === 'fail'), incomplete = tests.some(t => t.status === 'not_run' && t.name !== 'ITS_and_CK')
  return { ok: !failed && !incomplete, verdict: failed ? 'FAIL' : incomplete ? 'INSUFFICIENT_DATA' : 'C1_CHECKS_PASS', trusted_mode: failed || incomplete ? null : 'c1', tests, uncertainties }
}
