import { AU_TIME_FS, validateFrame } from '../core/frame.js'
import { PRNG } from '../sampling/prng.js'

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0)
export const kinetic = (P, masses) => P.reduce((s, x, i) => s + x * x / (2 * masses[i]), 0)
const norm = c => c.reduce((s, z) => s + z.re ** 2 + z.im ** 2, 0)
function rotate(c, basis) {
  return [0, 1].map(i => ({ re: c.reduce((s, z, j) => s + z.re * basis[j][i], 0), im: c.reduce((s, z, j) => s + z.im * basis[j][i], 0) }))
}
function project(c, basis) {
  return basis.map(row => ({ re: dot(row, c.map(z => z.re)), im: dot(row, c.map(z => z.im)) }))
}
// Exact unitary exp[-i (a sigma_z + b sigma_x) dt] for fixed real 2x2 H.
export function electronicUnitary(c, d, dt) {
  const co = Math.cos(d.r * dt), si = Math.sin(d.r * dt) / d.r
  const hc = [{ re: d.a * c[0].re + d.b * c[1].re, im: d.a * c[0].im + d.b * c[1].im }, { re: d.b * c[0].re - d.a * c[1].re, im: d.b * c[0].im - d.a * c[1].im }]
  // Common U phase omitted: it cancels all observables and relative phases.
  return c.map((z, i) => ({ re: co * z.re + si * hc[i].im, im: co * z.im - si * hc[i].re }))
}
export function rescaleMomentum(P, masses, nac, deltaE) {
  const A = 0.5 * nac.reduce((s, d, i) => s + d * d / masses[i], 0), B = nac.reduce((s, d, i) => s + P[i] * d / masses[i], 0)
  if (A < 1e-30) return { accepted: false, P: [...P], reason: 'zero_nac' }
  const discriminant = B * B - 4 * A * deltaE
  if (discriminant < 0) return { accepted: false, P: [...P], reason: 'insufficient_kinetic_energy_along_nac' }
  const gamma = (-B + (B >= 0 ? 1 : -1) * Math.sqrt(discriminant)) / (2 * A)
  return { accepted: true, P: P.map((v, i) => v + gamma * nac[i]) }
}
export function applyEDC(c, active, gap, K, dt, C = 0.1) {
  if (!(C >= 0 && Number.isFinite(C))) throw new RangeError('invalid EDC C')
  const other = 1 - active, decay = K > 0 ? Math.exp(-dt * gap / (1 + C / K)) : 1
  const out = structuredClone(c)
  out[other].re *= decay; out[other].im *= decay
  const target = Math.sqrt(Math.max(0, 1 - out[other].re ** 2 - out[other].im ** 2)), pop = Math.hypot(c[active].re, c[active].im)
  if (pop > 1e-15) { out[active].re *= target / pop; out[active].im *= target / pop }
  else { out[active] = { re: target, im: 0 } }
  return out
}
export function sampleFC(model, rng, config = {}) {
  const center = config.center ?? [-2, 0], omega = config.omega ?? model.parameters.omega
  if (center.length !== 2 || center.some(x => !Number.isFinite(x)) || !(omega > 0)) throw new RangeError('invalid FC Gaussian Wigner distribution')
  const R = center.map((x, i) => x + rng.normal() * Math.sqrt(1 / (2 * model.masses[i] * omega)))
  const P = center.map((_, i) => rng.normal() * Math.sqrt(model.masses[i] * omega / 2))
  return { R, P }
}
export function initialWalker(model, rng, { id, weight, fc, ledger }) {
  const { R, P } = sampleFC(model, rng, fc), surface = model.evaluate(R, ledger)
  const f = { traj_id: id, parent_id: null, step: 0, time_fs: 0, weight, active_state: 1, R_coords: R, P_momenta: P, elec_amplitudes: [{ re: 0, im: 0 }, { re: 1, im: 0 }], energies_adiabatic: surface.energies, delta_E_min: 2 * surface.r, hop_event: { occurred: false, from_state: null, to_state: null }, channel_sink_id: null, prng_seed: rng.seed, es_calls_increment: 0 }
  return { frame: validateFrame(f), weight, rng_state: rng.snapshot(), surface, reactive_history: [], initial_energy: kinetic(P, model.masses) + surface.energies[1] }
}
export function propagate(walker, model, { dt = 0.5, electronicSubsteps = 4, edcC = 0.1, edc = true, ledger } = {}) {
  if (!(dt > 0 && Number.isFinite(dt)) || !Number.isInteger(electronicSubsteps) || electronicSubsteps < 1) throw new RangeError('invalid integrator configuration')
  const f = walker.frame, active = f.active_state, rng = PRNG.restore(walker.rng_state)
  const P_half = f.P_momenta.map((p, i) => p - 0.5 * dt * walker.surface.gradients[active][i])
  const R = f.R_coords.map((r, i) => r + dt * P_half[i] / model.masses[i])
  const end = model.evaluate(R, ledger)
  let P = P_half.map((p, i) => p - 0.5 * dt * end.gradients[active][i]), diabatic = rotate(f.elec_amplitudes, walker.surface.basis), integrated = 0
  const h = dt / electronicSubsteps
  for (let j = 0; j < electronicSubsteps; j++) {
    const midR = R.map((r, i) => f.R_coords[i] + (r - f.R_coords[i]) * (j + 0.5) / electronicSubsteps), mid = model.evaluate(midR, ledger)
    const half = electronicUnitary(diabatic, mid, 0.5 * h), c = project(half, mid.basis)
    const pop = c[active].re ** 2 + c[active].im ** 2, coherence = c[0].re * c[1].re + c[0].im * c[1].im
    const vd = dot(P_half.map((p, i) => p / model.masses[i]), mid.nac01)
    if (pop > 1e-14) integrated += Math.max(0, 2 * h * (active === 0 ? 1 : -1) * coherence * vd / pop)
    diabatic = electronicUnitary(diabatic, mid, h)
  }
  if (!Number.isFinite(integrated) || integrated > 1) throw new Error('FSSH probability >1: reduce nuclear/electronic timestep')
  let state = active, frustrated = false
  const decision = rng.uniform()
  if (decision < integrated) {
    const hop = rescaleMomentum(P, model.masses, end.nac01, end.energies[1 - active] - end.energies[active])
    if (hop.accepted) { P = hop.P; state = 1 - active } else frustrated = true
  }
  let c = project(diabatic, end.basis)
  if (Math.abs(norm(c) - 1) > 1e-9) throw new Error('electronic unitarity violated')
  if (edc) c = applyEDC(c, state, 2 * end.r, kinetic(P, model.masses), dt, edcC)
  const next = { ...f, step: f.step + 1, time_fs: f.time_fs + dt * AU_TIME_FS, R_coords: R, P_momenta: P, elec_amplitudes: c, active_state: state, energies_adiabatic: end.energies, delta_E_min: 2 * end.r, hop_event: { occurred: state !== active, from_state: state !== active ? active : null, to_state: state !== active ? state : null }, es_calls_increment: 0 }
  walker.frame = validateFrame(next); walker.surface = end; walker.rng_state = rng.snapshot()
  return { frustrated, probability: integrated, energy: kinetic(P, model.masses) + end.energies[state], norm_error: Math.abs(norm(c) - 1) }
}
