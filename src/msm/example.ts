import { PRNG } from '../sampling/prng.js'
import type { ClassicalDataset } from './types.js'
export function generateClassicalExample(seed = 'msm-example', nTrajectories = 12, frames = 2000): ClassicalDataset {
  if (!Number.isInteger(nTrajectories) || nTrajectories < 1 || !Number.isInteger(frames) || frames < 2) throw new Error('invalid example size')
  const P = [[0.9, 0.1], [0.2, 0.8]]
  const trajectories = Array.from({ length: nTrajectories }, (_, m) => {
    const rng = new PRNG(`${seed}:${m}`), t = [rng.uniform() < 2 / 3 ? 0 : 1]
    for (let i = 1; i < frames; i++) t.push(rng.uniform() < P[t[i - 1]][0] ? 0 : 1)
    return t
  })
  return { kind: 'classical-trajectories', origin: 'synthetic-markov', frame_time: 1, time_unit: 'steps', trajectories }
}
