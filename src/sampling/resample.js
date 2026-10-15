import { assertMass } from '../core/frame.js'
import { deriveSeed } from './prng.js'
export function resample(walkers, { binOf, target, rng, epoch, absorbed = 0, maxWalkers = 10000 }) {
  assertMass(walkers, absorbed)
  const groups = new Map(), events = []
  for (const w of walkers) { const key = binOf(w.frame); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(w) }
  const output = []
  for (const [bin, group] of groups) {
    const count = typeof target === 'function' ? target(bin) : target
    if (!Number.isInteger(count) || count < 1 || count > maxWalkers) throw new RangeError('WE target must be positive integer within walker limit')
    let serial = 0
    while (group.length > count) {
      // Deterministic pairing is allowed; survivor selection must be weight proportional.
      group.sort((a, b) => a.weight - b.weight || a.frame.traj_id.localeCompare(b.frame.traj_id))
      const a = group.shift(), b = group.shift(), sum = a.weight + b.weight
      const chosen = rng.uniform() < a.weight / sum ? a : b, survivor = structuredClone(chosen)
      const id = `we:${epoch}:${bin}:merge:${serial++}`
      survivor.weight = sum; survivor.frame = { ...survivor.frame, traj_id: id, parent_id: chosen.frame.traj_id, weight: sum, hop_event: { occurred: false, from_state: null, to_state: null } }
      events.push({ type: 'merge', id, epoch, time_fs: chosen.frame.time_fs, parents: [{ id: a.frame.traj_id, weight: a.weight }, { id: b.frame.traj_id, weight: b.weight }], selected_parent: chosen.frame.traj_id, weight: sum, bin })
      group.push(survivor)
    }
    while (group.length < count) {
      group.sort((a, b) => b.weight - a.weight || a.frame.traj_id.localeCompare(b.frame.traj_id))
      const parent = group.shift(), k = Math.min(count - group.length, 2), children = []
      for (let j = 0; j < k; j++) {
        const child = structuredClone(parent), id = `we:${epoch}:${bin}:split:${serial++}:${j}`, seed = deriveSeed(parent.rng_state.seed, parent.rng_state.counter, epoch, id)
        child.weight = parent.weight / k
        child.frame = { ...child.frame, traj_id: id, parent_id: parent.frame.traj_id, weight: child.weight, prng_seed: seed, es_calls_increment: 0, hop_event: { occurred: false, from_state: null, to_state: null } }
        child.rng_state = { seed, counter: 0 }; children.push(id); group.push(child)
      }
      events.push({ type: 'split', epoch, time_fs: parent.frame.time_fs, parent: parent.frame.traj_id, children, parent_weight: parent.weight, bin })
    }
    output.push(...group)
    if (output.length > maxWalkers) throw new Error('WE walker limit exceeded; change bins/target')
  }
  assertMass(output, absorbed)
  return { walkers: output, events }
}
