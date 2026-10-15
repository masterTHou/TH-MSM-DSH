export function partition(frame, config = {}) {
  if (frame.channel_sink_id !== null) return `sink:${frame.channel_sink_id}`
  const threshold = config.gapThreshold ?? 0.05
  if (!Number.isFinite(threshold) || threshold < 0) throw new RangeError('invalid gap threshold')
  const values = config.progress ? config.progress(frame) : config.features ? geometricFeatures(frame.R_coords, config.features) : frame.R_coords
  const widths = config.widths ?? values.map(() => 0.5)
  if (widths.length !== values.length || widths.some(w => !Number.isFinite(w) || w <= 0)) throw new RangeError('invalid bin widths')
  if (values.length !== widths.length || values.some(v => !Number.isFinite(v))) throw new RangeError('invalid progress coordinates')
  return `S${frame.active_state}|${frame.delta_E_min <= threshold ? 'small-gap' : 'adiabatic'}|${values.map((v, i) => Math.floor(v / widths[i])).join(',')}`
}
export function geometricFeatures(R, features) {
  const atom = i => {
    if (!Number.isInteger(i) || i < 0 || 3 * i + 2 >= R.length) throw new RangeError('atom index outside flat 3N coordinates')
    return R.slice(3 * i, 3 * i + 3)
  }
  const diff = (a, b) => a.map((v, i) => v - b[i])
  return features.map(f => {
    if (f.type === 'distance') return Math.hypot(...diff(atom(f.atoms[0]), atom(f.atoms[1])))
    if (f.type === 'angle') {
      const a = diff(atom(f.atoms[0]), atom(f.atoms[1])), b = diff(atom(f.atoms[2]), atom(f.atoms[1])), den = Math.hypot(...a) * Math.hypot(...b)
      if (den === 0) throw new Error('angle undefined for coincident atoms')
      return Math.acos(Math.max(-1, Math.min(1, a.reduce((s, x, i) => s + x * b[i], 0) / den)))
    }
    if (f.type === 'aligned-rmsd') {
      if (f.prealigned !== true || !Array.isArray(f.reference) || f.reference.length !== R.length) throw new Error('RMSD requires explicitly prealigned equal-dimension coordinates')
      return Math.sqrt(R.reduce((s, v, i) => s + (v - f.reference[i]) ** 2, 0) / (R.length / 3))
    }
    if (f.type === 'component' && Number.isInteger(f.index) && f.index >= 0 && f.index < R.length) return R[f.index]
    throw new Error('unsupported progress feature')
  })
}
export function candidateVisits(frame, candidates = []) {
  return candidates.filter(c => {
    if (c.label !== 'C_candidate' || typeof c.id !== 'string' || !c.id || !Array.isArray(c.center) || c.center.length !== frame.R_coords.length || c.center.some(x => !Number.isFinite(x)) || !Number.isFinite(c.radius) || c.radius <= 0 || !Number.isFinite(c.gapThreshold) || c.gapThreshold < 0) throw new TypeError('invalid C_candidate definition')
    return frame.delta_E_min <= c.gapThreshold && Math.hypot(...frame.R_coords.map((x, i) => x - c.center[i])) <= c.radius
  }).map(c => c.id)
}
