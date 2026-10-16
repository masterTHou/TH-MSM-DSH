import { validateMSM } from '../msm/validation.js'
import { createHash } from 'node:crypto'
export function validateLesson(lesson) {
  const finite = value => typeof value === 'number' && Number.isFinite(value)
  if (!lesson || lesson.schema_version !== 1 || validateMSM(lesson.model).verdict === 'INVALID_MODEL' || JSON.stringify(lesson.model.labels) !== '[0,1,2]' || JSON.stringify(lesson.state_names) !== '["trans","gauche+","gauche-"]') throw new Error('INVALID_LESSON: three-state butane lesson required')
  const m=lesson.manifest,s=lesson.settings,p=lesson.preview
  const model=lesson.model
  if (!Number.isInteger(model.lag_frames) || model.lag_frames<1 || !finite(model.validation.ck_tolerance) || !Number.isInteger(model.validation.min_counts_per_row) || !Number.isInteger(model.provenance?.training_trajectories) || !Number.isInteger(model.provenance?.validation_trajectories)) throw new Error('INVALID_LESSON: numeric MSM metadata required')
  if (!m || !s || !p || !['n_trajectories','production_ps_per_trajectory','equilibration_ps_per_trajectory','temperature_k','frame_time_ps','total_wall_seconds_through_plots','python_peak_memory_mib'].every(k=>finite(m[k]) && m[k]>0) || !['friction_ps_inverse','dt_fs','bond_nm','angle_degrees'].every(k=>finite(s[k]) && s[k]>0) || !Array.isArray(s.torsion_V_kj_mol) || s.torsion_V_kj_mol.length!==3 || !s.torsion_V_kj_mol.every(finite)) throw new Error('INVALID_LESSON: numeric metadata required')
  const n=p.time_ps?.length
  if (!Number.isInteger(n) || n<2 || n>1001 || !finite(p.frame_time_ps) || p.frame_time_ps<=0 || !p.time_ps.every(finite) || !Array.isArray(p.phi_degrees) || p.phi_degrees.length!==n || !p.phi_degrees.every(finite) || !Array.isArray(p.states) || p.states.length!==n || !p.states.every(x=>[0,1,2].includes(x)) || !Array.isArray(p.coordinates_nm) || p.coordinates_nm.length!==n || !p.coordinates_nm.every(x=>Array.isArray(x)&&x.length===4&&x.every(v=>Array.isArray(v)&&v.length===3&&v.every(finite)))) throw new Error('INVALID_LESSON: finite bounded recorded preview required')
  if (!Array.isArray(m.nve_diagnostics) || !m.nve_diagnostics.every(x=>finite(x.dt_fs)&&finite(x.max_abs_energy_change_kj_mol)) || !Array.isArray(lesson.figure_images) || lesson.figure_images.length!==6 || !lesson.figure_images.every(x=>typeof x==='string' && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(x) && x.length<2000000)) throw new Error('INVALID_LESSON: six embedded PNG figures required')
  if (!Array.isArray(m.theoretical_torsion_boltzmann_populations) || m.theoretical_torsion_boltzmann_populations.length!==3 || !m.theoretical_torsion_boltzmann_populations.every(x=>finite(x)&&x>=0&&x<=1)) throw new Error('INVALID_LESSON: reference populations required')
  if (!Array.isArray(lesson.figures) || lesson.figures.length!==6 || !lesson.figure_sha256 || lesson.figure_images.some((image,i)=>createHash('sha256').update(Buffer.from(image.split(',')[1],'base64')).digest('hex')!==lesson.figure_sha256[lesson.figures[i]])) throw new Error('INVALID_LESSON: figure checksum mismatch')
  const verdict=validateMSM(lesson.model).verdict
  return {...lesson, analysis: {...lesson.analysis, validation: {...lesson.analysis?.validation, verdict}}}
}
