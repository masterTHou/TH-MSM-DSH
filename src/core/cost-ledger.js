export class CostLedger {
  constructor() { this.total_es_calls = 0; this.model_evaluations = 0; this.cache_hits = 0; this.by_stage = {} }
  async electronicStructure(stage, provider, request) {
    // Count attempts, including failures/retries. All exploration must use this gateway.
    this.total_es_calls++; this.by_stage[stage] = (this.by_stage[stage] ?? 0) + 1
    return provider(request)
  }
  analytic() { this.model_evaluations++ }
  snapshot() { return structuredClone({ total_es_calls: this.total_es_calls, model_evaluations: this.model_evaluations, cache_hits: this.cache_hits, by_stage: this.by_stage }) }
}
