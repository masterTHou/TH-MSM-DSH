import { Matrix, EigenvalueDecomposition, solve } from 'ml-matrix'
import type { SpectralMode } from './types.js'

export function requireStochastic(P: number[][]): void {
  const n = P.length
  if (n < 2 || n > 128 || P.some(row => row.length !== n || row.some(x => !Number.isFinite(x) || x < 0) || Math.abs(row.reduce((a, b) => a + b, 0) - 1) > 1e-10)) throw new Error('finite stochastic matrix with 2–128 states required')
}
export function stronglyConnected(P: number[][]): boolean {
  const reach = (reverse: boolean): number => {
    const seen = new Set([0]), stack = [0]
    while (stack.length) {
      const i = stack.pop()!
      for (let j = 0; j < P.length; j++) if ((reverse ? P[j][i] : P[i][j]) > 0 && !seen.has(j)) { seen.add(j); stack.push(j) }
    }
    return seen.size
  }
  return reach(false) === P.length && reach(true) === P.length
}
export function stationary(P: number[][]): number[] {
  requireStochastic(P)
  if (!stronglyConnected(P)) throw new Error('disconnected/reducible transition graph: refine data/state space; no silent component deletion')
  const n = P.length, A = P.map((_, i) => P.map((row, j) => row[i] - (i === j ? 1 : 0))), b = Array(n).fill(0) as number[]
  A[n - 1] = Array(n).fill(1); b[n - 1] = 1
  const pi = solve(new Matrix(A), Matrix.columnVector(b)).to1DArray()
  if (pi.some(x => !Number.isFinite(x) || x < -1e-10)) throw new Error('stationary solver failed positivity')
  const sum = pi.reduce((s, x) => s + Math.max(0, x), 0), normalized = pi.map(x => Math.max(0, x) / sum)
  const residual = Math.max(...P.map((_, j) => Math.abs(normalized.reduce((s, x, i) => s + x * P[i][j], 0) - normalized[j])))
  if (residual > 1e-9) throw new Error('stationary solver residual too large')
  return normalized
}
export function spectralModes(P: number[][], lagTime: number): SpectralMode[] {
  requireStochastic(P)
  if (!(lagTime > 0 && Number.isFinite(lagTime))) throw new Error('positive lag time required')
  const evd = new EigenvalueDecomposition(new Matrix(P))
  const modes = evd.realEigenvalues.map((re, i) => ({ re, im: evd.imaginaryEigenvalues[i] }))
  const stationaryIndex = modes.reduce((best, x, i) => Math.hypot(x.re - 1, x.im) < Math.hypot(modes[best].re - 1, modes[best].im) ? i : best, 0)
  return modes.filter((_, i) => i !== stationaryIndex).sort((a, b) => Math.hypot(b.re, b.im) - Math.hypot(a.re, a.im)).map(eigenvalue => {
    const modulus = Math.hypot(eigenvalue.re, eigenvalue.im)
    if (modulus > 1 + 1e-8) throw new Error('stochastic spectrum outside unit circle')
    return { eigenvalue, decay_time: modulus >= 1 - 1e-12 ? null : modulus <= 1e-15 ? 0 : -lagTime / Math.log(modulus), oscillatory: eigenvalue.re < 0 || Math.abs(eigenvalue.im) > 1e-10 }
  })
}
export function matrixPower(P: number[][], power: number): number[][] {
  if (!Number.isInteger(power) || power < 1) throw new Error('positive integer power required')
  let out = Matrix.eye(P.length), base = new Matrix(P), k = power
  while (k) { if (k % 2) out = out.mmul(base); base = base.mmul(base); k = Math.floor(k / 2) }
  return out.to2DArray()
}
export function mfpt(P: number[][], target: number, lagTime: number): number[] {
  requireStochastic(P)
  if (!Number.isInteger(target) || target < 0 || target >= P.length || !stronglyConnected(P) || !(lagTime > 0)) throw new Error('MFPT requires reachable target, irreducible chain and positive lag')
  const states = P.map((_, i) => i).filter(i => i !== target)
  const A = states.map(i => states.map(j => (i === j ? 1 : 0) - P[i][j]))
  const values = solve(new Matrix(A), Matrix.ones(states.length, 1)).to1DArray().map(x => x * lagTime)
  if (values.some(x => !Number.isFinite(x) || x < 0)) throw new Error('MFPT solution invalid')
  const out = Array(P.length).fill(0) as number[]; states.forEach((s, i) => { out[s] = values[i] }); return out
}
