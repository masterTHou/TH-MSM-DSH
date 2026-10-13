/**
 * Hybrid Retriever — Combine vector similarity + keyword matching.
 *
 * This is the main retrieval API that replaces/enhances the old
 * keyword-only searcher. It uses reciprocal rank fusion (RRF) to
 * combine results from both retrieval paths.
 *
 * Usage:
 *   const retriever = await getRetriever(workspace)
 *   const results = await retriever.retrieve("MSM lag time selection", { topK: 10 })
 */

import { embed, dispose } from './embedder.js'
import { openStore } from './store.js'
import { searchKnowledge } from '../searcher.js'

let _retriever = null

/**
 * Get (or create) the hybrid retriever singleton.
 */
export async function getRetriever(workspace) {
  if (_retriever) return _retriever
  _retriever = new HybridRetriever(workspace)
  return _retriever
}

class HybridRetriever {
  constructor(workspace) {
    this._workspace = workspace
    this._store = null
  }

  async _ensureStore() {
    if (!this._store) {
      this._store = await openStore(this._workspace)
    }
    return this._store
  }

  /**
   * Hybrid retrieval: vector + keyword fusion.
   *
   * @param {string} query — Natural language query
   * @param {object} opts
   * @param {number} opts.topK — Final number of results (default 10)
   * @param {number} opts.vectorWeight — Weight for vector results (0-1, default 0.7)
   * @param {string} opts.filterTopic — Only return papers of this topic
   * @param {string} opts.filterSource — Only "reviews", "papers", or "benchmarks"
   * @param {string} opts.filterLevel — Only papers at this level
   * @param {boolean} opts.useVector — Enable vector search (default true)
   * @param {boolean} opts.useKeyword — Enable keyword search (default true)
   * @returns {object[]} Array of { id, title, score, text, metadata, source }
   */
  async retrieve(query, opts = {}) {
    const {
      topK = 10,
      vectorWeight = 0.7,
      filterTopic,
      filterSource,
      filterLevel,
      useVector = true,
      useKeyword = true,
    } = opts

    const vectorResults = []
    const keywordResults = []

    // ── Vector search ──────────────────────────────────────────
    if (useVector) {
      try {
        const store = await this._ensureStore()
        const queryVec = await embed(query)
        const vecResults = await store.search(queryVec, {
          limit: topK * 2,  // Over-fetch for fusion
          minScore: 0.2,
          filterSource,
          filterTopic,
        })
        for (const r of vecResults) {
          vectorResults.push({
            ...r,
            _source: 'vector',
            _vectorScore: r.score,
          })
        }
      } catch (error) {
        // Vector search unavailable — fall through to keyword only
      }
    }

    // ── Keyword search ─────────────────────────────────────────
    if (useKeyword) {
      // Need a papers array — use the metadata from vector store results
      // or fall back to empty if vector store is not available.
      // For now: use the legacy keyword searcher which requires a kb object.
      // In production the retriever should cache a local papers index.
      const kwResults = searchKnowledge(
        { papers: vectorResults.map(r => r.metadata).filter(Boolean) },
        {
          query,
          topic: filterTopic,
          level: filterLevel,
          maxResults: topK * 2,
        }
      )
      for (const r of kwResults) {
        if (!r.relevance) r.relevance = 0.5
        keywordResults.push({
          id: r.id,
          text: `${r.title} ${r.keywords?.join(' ') ?? ''}`,
          score: r.relevance,
          metadata: r,
          _source: 'keyword',
          _keywordScore: r.relevance,
        })
      }
    }

    // ── Reciprocal Rank Fusion (RRF) ───────────────────────────
    const fused = rrf(vectorResults, keywordResults, {
      k: 60,
      vectorWeight,
    })

    // ── Post-filter by level ───────────────────────────────────
    let results = fused
    if (filterLevel) {
      results = results.filter(r => {
        const meta = r.metadata
        return meta?.level?.some(l => l.toLowerCase() === filterLevel.toLowerCase())
      })
    }

    return results.slice(0, topK).map(r => ({
      id: r.id,
      title: r.metadata?.title ?? r.text,
      score: r._fusedScore ?? r.score,
      text: r.text,
      metadata: r.metadata,
      source: r._source ?? 'unknown',
      vectorScore: r._vectorScore,
      keywordScore: r._keywordScore,
    }))
  }

  /**
   * Check if the retriever is ready (index exists).
   */
  async isReady() {
    try {
      const store = await this._ensureStore()
      const count = await store.count()
      return count > 0
    } catch {
      return false
    }
  }

  /**
   * Release resources.
   */
  async dispose() {
    await dispose()
    _retriever = null
  }
}

/**
 * Reciprocal Rank Fusion.
 *
 * Each result gets score = 1 / (k + rank_in_list).
 * Final score = vectorWeight * vector_rrf + (1-vectorWeight) * keyword_rrf.
 */
function rrf(vectorResults, keywordResults, { k = 60, vectorWeight = 0.7 } = {}) {
  const merged = new Map()

  // Insert vector results
  vectorResults.forEach((r, rank) => {
    const rrfScore = 1 / (k + rank + 1)
    merged.set(r.id, {
      ...r,
      _vectorRrf: rrfScore,
      _keywordRrf: 0,
    })
  })

  // Insert keyword results
  keywordResults.forEach((r, rank) => {
    const rrfScore = 1 / (k + rank + 1)
    const existing = merged.get(r.id)
    if (existing) {
      existing._keywordRrf = rrfScore
    } else {
      merged.set(r.id, {
        ...r,
        _vectorRrf: 0,
        _keywordRrf: rrfScore,
      })
    }
  })

  // Compute fused score
  const entries = [...merged.values()].map(e => ({
    ...e,
    _fusedScore: vectorWeight * e._vectorRrf + (1 - vectorWeight) * e._keywordRrf,
  }))

  // Sort by fused score descending
  entries.sort((a, b) => b._fusedScore - a._fusedScore)

  return entries
}