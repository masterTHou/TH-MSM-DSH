import type { GuideState } from './wizard.js'
// DSH may hydrate a new session object between turns; its header ID stays stable.
export class GuideSessionStore {
  private readonly stable = new Map<string, GuideState>()
  private readonly objects = new WeakMap<object, GuideState>()
  private key(owner: object): string | null {
    const header = (owner as { header?: { id?: unknown; cwd?: unknown } }).header
    return typeof header?.id === 'string' && header.id ? JSON.stringify([header.id, header.cwd ?? '']) : null
  }
  get(owner: unknown): GuideState {
    if (!owner || typeof owner !== 'object') return {}
    const key = this.key(owner), value = key ? this.stable.get(key) : this.objects.get(owner)
    return value ? structuredClone(value) : {}
  }
  set(owner: unknown, state: GuideState): void {
    if (!owner || typeof owner !== 'object') return
    const key = this.key(owner), value = structuredClone(state)
    if (!key) { this.objects.set(owner, value); return }
    this.stable.delete(key); this.stable.set(key, value)
    if (this.stable.size > 128) this.stable.delete(this.stable.keys().next().value!)
  }
}
