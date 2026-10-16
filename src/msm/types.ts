import type { Diagnostic } from '../types/science.js'
export interface ClassicalDataset {
  kind: 'classical-trajectories'
  origin: 'unbiased-md' | 'synthetic-markov'
  trajectories: number[][]
  frame_time: number
  time_unit: 'steps' | 'fs' | 'ps' | 'ns'
}
export interface FeatureDataset {
  kind: 'classical-features'
  origin: ClassicalDataset['origin']
  feature_trajectories: number[][][]
  frame_time: number
  time_unit: ClassicalDataset['time_unit']
}
export interface SpectralMode {
  eigenvalue: { re: number; im: number }
  decay_time: number | null
  oscillatory: boolean
}
export interface MSMModel {
  schema_version: 1
  kind: 'classical-msm'
  estimator: 'nonreversible-row-mle'
  labels: number[]
  lag_frames: number
  lag_time: number
  time_unit: ClassicalDataset['time_unit']
  counts: number[][]
  transition_matrix: number[][]
  stationary_distribution: number[]
  spectrum: SpectralMode[]
  diagnostics: Diagnostic[]
  validation: {
    verdict: 'SUPPORTED_AT_TESTED_LAGS' | 'MARKOV_ASSUMPTION_UNSUPPORTED' | 'INSUFFICIENT_DATA'
    its: { lag_frames: number; modes: SpectralMode[]; error?: string }[]
    ck: { multiple: number; weighted_rmse: number | null; supported_rows: number; status: Diagnostic['status'] }[]
    ck_tolerance: number
    min_counts_per_row: number
    validation_trajectories: number
  }
  provenance: { data_digest: string; training_trajectories: number; validation_trajectories: number; origin: ClassicalDataset['origin'] }
  clustering?: { method: 'kmeans'; centers: number[][]; feature_dimension: number; fit_on: 'training_only' }
}
