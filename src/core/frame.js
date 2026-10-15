// Atomic units internally; time_fs is the public clock.
export const AU_TIME_FS = 0.024188843265857
export function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`)
  return value
}
export function validateFrame(f) {
  if (!f || typeof f !== 'object') throw new TypeError('frame required')
  for (const k of ['traj_id', 'prng_seed']) if (typeof f[k] !== 'string' || !f[k]) throw new TypeError(`${k} required`)
  if (f.parent_id !== null && typeof f.parent_id !== 'string') throw new TypeError('parent_id must be null or string')
  if (!Number.isInteger(f.step) || f.step < 0) throw new RangeError('invalid step')
  if (finite(f.time_fs, 'time_fs') < 0 || finite(f.weight, 'weight') <= 0 || f.weight > 1 + 1e-12) throw new RangeError('invalid time/weight')
  for (const k of ['R_coords', 'P_momenta', 'energies_adiabatic']) {
    if (!Array.isArray(f[k]) || !f[k].length) throw new TypeError(`${k} must be a nonempty flat array`)
    f[k].forEach(x => finite(x, k))
  }
  if (f.R_coords.length !== f.P_momenta.length) throw new RangeError('R/P dimension mismatch')
  const n = f.energies_adiabatic.length
  if (n < 2 || !Number.isInteger(f.active_state) || f.active_state < 0 || f.active_state >= n) throw new RangeError('invalid active_state')
  if (!Array.isArray(f.elec_amplitudes) || f.elec_amplitudes.length !== n) throw new RangeError('amplitude dimension mismatch')
  let norm = 0
  for (const c of f.elec_amplitudes) norm += finite(c.re, 'amplitude.re') ** 2 + finite(c.im, 'amplitude.im') ** 2
  if (Math.abs(norm - 1) > 1e-8) throw new RangeError('electronic amplitudes not normalized')
  let gap = Infinity
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) gap = Math.min(gap, Math.abs(f.energies_adiabatic[i] - f.energies_adiabatic[j]))
  if (Math.abs(finite(f.delta_E_min, 'delta_E_min') - gap) > 1e-10) throw new RangeError('delta_E_min inconsistent with energies')
  if (!f.hop_event || typeof f.hop_event.occurred !== 'boolean') throw new TypeError('hop_event required')
  if (f.hop_event.occurred) {
    const { from_state: a, to_state: b } = f.hop_event
    if (![a, b].every(s => Number.isInteger(s) && s >= 0 && s < n) || a === b || b !== f.active_state) throw new RangeError('invalid hop states')
  }
  if (f.channel_sink_id !== null && (typeof f.channel_sink_id !== 'string' || !f.channel_sink_id)) throw new TypeError('invalid sink')
  if (!Number.isSafeInteger(f.es_calls_increment) || f.es_calls_increment < 0) throw new RangeError('invalid ES increment')
  return f
}
export function assertMass(walkers, absorbed = 0) {
  let sum = absorbed, correction = 0
  for (const w of walkers) {
    if (!Number.isFinite(w.weight) || w.weight <= 0) throw new RangeError('invalid walker weight')
    const y = w.weight - correction, t = sum + y
    correction = (t - sum) - y; sum = t
  }
  if (Math.abs(sum - 1) >= 1e-12) throw new Error(`weight conservation violated: ${sum}`)
  return sum
}
