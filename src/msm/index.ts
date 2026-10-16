import { fitMSM, validateDataset, type FitOptions } from './estimate.js'
import { assignFeatures, kmeans } from './features.js'
import type { ClassicalDataset, FeatureDataset, MSMModel } from './types.js'
export { fitMSM, validateDataset, transitionCounts, normalizeCounts } from './estimate.js'
export { mfpt, stationary, spectralModes } from './numerics.js'
export { kmeans, assignFeatures } from './features.js'
export type { ClassicalDataset, FeatureDataset, MSMModel } from './types.js'
export { generateClassicalExample } from './example.js'

export interface BuildMSMOptions extends FitOptions { nClusters?: number; seed?: string; holdoutFraction?: number }
export function buildClassicalModel(input: unknown, options: BuildMSMOptions = {}): MSMModel {
  const fraction = options.holdoutFraction ?? 0.25
  if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 0.5) throw new Error('holdoutFraction must lie in [0,0.5)')
  if (!input || typeof input !== 'object') throw new Error('classical dataset object required')
  let dataset: ClassicalDataset, clustering: MSMModel['clustering']
  const raw = input as Partial<FeatureDataset>
  if (raw.kind === 'classical-features') {
    if (!Array.isArray(raw.feature_trajectories) || raw.feature_trajectories.some(t => !Array.isArray(t) || t.length < 2 || t.some(p => !Array.isArray(p)))) throw new Error('feature trajectories must preserve boundaries and contain at least two frames')
    const n = raw.feature_trajectories.length, heldout = n >= 4 ? Math.floor(n * fraction) : 0
    const training = raw.feature_trajectories.slice(0, n - heldout), validation = heldout ? raw.feature_trajectories.slice(n - heldout) : []
    const centers = kmeans(training, options.nClusters ?? 8, options.seed)
    for (const t of validation) for (const p of t) if (p.length !== centers[0].length || p.some(x => !Number.isFinite(x))) throw new Error('invalid held-out features')
    dataset = { kind: 'classical-trajectories', origin: raw.origin!, frame_time: raw.frame_time!, time_unit: raw.time_unit!, trajectories: assignFeatures(training, centers) }
    options = { ...options, validationTrajectories: assignFeatures(validation, centers) }
    clustering = { method: 'kmeans', centers, feature_dimension: centers[0].length, fit_on: 'training_only' }
  } else {
    validateDataset(input)
    const n = input.trajectories.length, heldout = options.validationTrajectories ? 0 : n >= 4 ? Math.floor(n * fraction) : 0
    dataset = { ...input, trajectories: input.trajectories.slice(0, n - heldout) }
    if (heldout) options = { ...options, validationTrajectories: input.trajectories.slice(n - heldout) }
  }
  const model = fitMSM(dataset, options)
  if (clustering) model.clustering = clustering
  return model
}
export { validateMSM, mfptToState } from './validation.js'
