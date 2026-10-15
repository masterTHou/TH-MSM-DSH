// Hartree, bohr, electron masses and atomic time. Explicit analytic model.
export function createLVC(options = {}) {
  const p = { mass: 2000, omega: 0.004, kappa: 0.012, lambda: 0.008, ...options }
  for (const [k, v] of Object.entries(p)) if (!Number.isFinite(v) || v <= 0) throw new RangeError(`invalid LVC parameter ${k}`)
  return makeTwoStateModel('standard-lvc-2d', p, ([x, y]) => {
    const k = p.mass * p.omega ** 2
    return { U: 0.5 * k * (x * x + y * y), dU: [k * x, k * y], a: p.kappa * x, da: [p.kappa, 0], b: p.lambda * y, db: [0, p.lambda] }
  }, [[0, 0]])
}
export function makeTwoStateModel(name, parameters, diabatic, intersections) {
  const mass = parameters.mass
  return {
    name, parameters, masses: [mass, mass], intersections,
    evaluate(R, ledger) {
      ledger?.analytic()
      const d = diabatic(R), r = Math.hypot(d.a, d.b)
      // Exact degeneracy has undefined adiabatic basis/NAC: stop rather than regularize silently.
      if (r < 1e-12) throw new Error('exact CI singularity: reduce timestep/change FC sample; no silent NAC regularization')
      const theta = 0.5 * Math.atan2(d.b, d.a), s = Math.sin(theta), c = Math.cos(theta)
      const dr = d.da.map((a, i) => (d.a * a + d.b * d.db[i]) / r)
      return { ...d, energies: [d.U - r, d.U + r], gradients: [d.dU.map((u, i) => u - dr[i]), d.dU.map((u, i) => u + dr[i])], nac01: d.da.map((a, i) => 0.5 * (d.a * d.db[i] - d.b * a) / (r * r)), basis: [[-s, c], [c, s]], r }
    },
  }
}
