export interface ComplexAmplitude { re: number; im: number }
export type HopEvent = { occurred: false; from_state: null; to_state: null } | { occurred: true; from_state: number; to_state: number }
export interface TrajectoryFrame {
  traj_id: string
  parent_id: string | null
  step: number
  time_fs: number
  weight: number
  active_state: number
  R_coords: number[]
  P_momenta: number[]
  elec_amplitudes: ComplexAmplitude[]
  energies_adiabatic: number[]
  delta_E_min: number
  hop_event: HopEvent
  channel_sink_id: string | null
  prng_seed: string
  es_calls_increment: number
}
export type AnalysisDomain = 'classical-msm' | 'nonadiabatic-c1'
export type Verdict = 'pass' | 'fail' | 'insufficient_data'
export interface Diagnostic {
  name: string
  status: Verdict
  details: string
}
