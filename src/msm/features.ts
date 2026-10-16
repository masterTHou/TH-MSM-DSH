import { PRNG } from '../sampling/prng.js'
const distance2 = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0)
export function assignFeatures(trajectories: number[][][], centers: number[][]): number[][] {
  return trajectories.map(t => t.map(x => centers.reduce((best, c, i) => distance2(x, c) < distance2(x, centers[best]) ? i : best, 0)))
}
export function kmeans(trajectories: number[][][], clusters: number, seed = 'kmeans'): number[][] {
  const points = trajectories.flat(), dim = points[0]?.length
  if (!dim || points.some(p => p.length !== dim || p.some(x => !Number.isFinite(x))) || !Number.isInteger(clusters) || clusters < 2 || clusters > 128 || clusters > points.length) throw new Error('finite equal-dimension features and 2–128 clusters required')
  const rng = new PRNG(seed), centers: number[][] = [[...points[Math.floor(rng.uniform() * points.length)]]]
  while (centers.length < clusters) {
    const distances = points.map(p => Math.min(...centers.map(c => distance2(p, c)))), total = distances.reduce((a, b) => a + b, 0)
    if (total === 0) throw new Error('more clusters than distinct feature points')
    let pick = rng.uniform() * total, selected = points.length - 1
    for (let i = 0; i < points.length; i++) { pick -= distances[i]; if (pick <= 0) { selected = i; break } }
    centers.push([...points[selected]])
  }
  for (let iteration = 0; iteration < 100; iteration++) {
    const sums = centers.map(() => Array(dim).fill(0) as number[]), counts = centers.map(() => 0)
    for (const p of points) {
      const index = centers.reduce((best, c, i) => distance2(p, c) < distance2(p, centers[best]) ? i : best, 0)
      counts[index]++; p.forEach((x, j) => { sums[index][j] += x })
    }
    if (counts.some(n => n === 0)) throw new Error('empty kmeans cluster: reduce cluster count/change features')
    const next = sums.map((s, i) => s.map(x => x / counts[i]))
    const movement = Math.max(...centers.map((c, i) => distance2(c, next[i])))
    centers.splice(0, centers.length, ...next)
    if (movement < 1e-16) return centers
  }
  throw new Error('kmeans did not converge in 100 iterations')
}
