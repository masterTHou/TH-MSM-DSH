import { makeTwoStateModel } from './lvc-2d.js'
// Extended nonlinear vibronic model: two isolated CIs, explicitly NOT LVC.
// The +y funnel has a higher common potential; no prescribed branch probability.
export function createDualCI(options = {}) {
  const p = { mass: 2000, omega: 0.004, kappa: 0.012, lambda: 0.008, separation: 1, tilt: 0.004, ...options }
  for (const [k, v] of Object.entries(p)) if (!Number.isFinite(v) || (k !== 'tilt' && v <= 0)) throw new RangeError(`invalid dual-CI parameter ${k}`)
  return makeTwoStateModel('extended-nonlinear-dual-ci-2d', p, ([x, y]) => {
    const k = p.mass * p.omega ** 2, z = y + p.separation
    return { U: 0.5 * k * x * x + 0.125 * k * z * z + p.tilt * y, dU: [k * x, 0.25 * k * z + p.tilt], a: p.kappa * x, da: [p.kappa, 0], b: p.lambda * (y * y - p.separation ** 2), db: [0, 2 * p.lambda * y] }
  }, [[0, -p.separation], [0, p.separation]])
}
