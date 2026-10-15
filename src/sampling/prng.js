// Counter keyed SHA-256 streams: explicit state, reproducible across platforms.
import { createHash } from 'node:crypto'
export class PRNG {
  constructor(seed, counter = 0) {
    if (typeof seed !== 'string' || !seed || !Number.isSafeInteger(counter) || counter < 0) throw new TypeError('invalid PRNG state')
    this.seed = seed; this.counter = counter
  }
  uniform() {
    if (this.counter >= Number.MAX_SAFE_INTEGER) throw new RangeError('PRNG counter exhausted')
    const b = createHash('sha256').update(JSON.stringify([this.seed, this.counter++])).digest()
    return (b.readUIntBE(0, 6) + 0.5) / 281474976710656
  }
  normal() { return Math.sqrt(-2 * Math.log(this.uniform())) * Math.cos(2 * Math.PI * this.uniform()) }
  snapshot() { return { seed: this.seed, counter: this.counter } }
  static restore(s) { return new PRNG(s.seed, s.counter) }
}
export function deriveSeed(...labels) { return createHash('sha256').update(JSON.stringify(labels)).digest('hex') }
