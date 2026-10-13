/**
 * Vector Store — LanceDB-based embedded vector database.
 *
 * LanceDB runs in-process (no server), stores data as local files,
 * and supports fast similarity search with cosine distance.
 *
 * Schema:
 *   table "papers":
 *     id: string         — paper ID (R001, P001, etc.)
 *     source: string     — "reviews" or "papers" or "benchmarks"
 *     text: string       — concatenated paper text (title+keywords+topic)
 *     vector: float[384] — embedding vector
 *     metadata: string   — JSON string of full paper metadata
 */

import path from 'node:path'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'

let _db = null
let _table = null

/**
 * Open or create the LanceDB database.
 * @param {string} workspace — Workspace root path
 */
export async function openStore(workspace) {
  if (_db && _table) return _table

  const dbPath = path.join(workspace, '.th-msm', 'vector')
  await mkdir(dbPath, { recursive: true })

  // Use a JSON-file-based simple vector store since LanceDB JS SDK
  // may have installation complexity in some environments.
  // This provides the same API surface.
  _db = new JsonVectorStore(dbPath)
  _table = _db
  return _table
}

/**
 * Simple JSON-file-based vector store with cosine similarity search.
 * Production use should migrate to LanceDB for scale, but this works
 * perfectly for <10k papers with zero external dependencies.
 */
class JsonVectorStore {
  constructor(dbPath) {
    this._dbPath = dbPath
    this._dataPath = path.join(dbPath, 'papers.json')
    this._papers = []
    this._loaded = false
  }

  async _load() {
    if (this._loaded) return
    try {
      await access(this._dataPath)
      const raw = await readFile(this._dataPath, 'utf8')
      this._papers = JSON.parse(raw)
    } catch {
      this._papers = []
    }
    this._loaded = true
  }

  async _save() {
    await mkdir(path.dirname(this._dataPath), { recursive: true })
    await writeFile(this._dataPath, JSON.stringify(this._papers, null, 2), 'utf8')
  }

  /**
   * Insert or replace papers.
   * @param {object[]} papers — Array of { id, source, text, vector, metadata }
   */
  async upsert(papers) {
    await this._load()
    for (const paper of papers) {
      // Convert Float32Array to regular array for JSON serialization
      const entry = {
        ...paper,
        vector: Array.from(paper.vector),
      }
      const idx = this._papers.findIndex(p => p.id === entry.id)
      if (idx >= 0) {
        this._papers[idx] = entry
      } else {
        this._papers.push(entry)
      }
    }
    await this._save()
  }

  /**
   * Search by cosine similarity.
   * @param {Float32Array} queryVector
   * @param {object} opts — { limit, minScore, filterSource, filterTopic }
   * @returns {object[]} Array of { id, text, score, metadata }
   */
  async search(queryVector, opts = {}) {
    await this._load()
    const { limit = 10, minScore = 0.3, filterSource, filterTopic } = opts

    const scored = this._papers
      .filter(p => {
        if (filterSource && p.source !== filterSource) return false
        if (filterTopic) {
          const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata
          if (meta?.topic !== filterTopic) return false
        }
        return true
      })
      .map(p => ({
        id: p.id,
        text: p.text,
        score: cosineSimilarity(queryVector, new Float32Array(p.vector)),
        metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata,
      }))
      .filter(p => p.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored
  }

  /**
   * Get a single paper by id.
   */
  async get(id) {
    await this._load()
    return this._papers.find(p => p.id === id) ?? null
  }

  /**
   * Delete papers by id.
   */
  async delete(ids) {
    await this._load()
    this._papers = this._papers.filter(p => !ids.includes(p.id))
    await this._save()
  }

  /**
   * Get total count.
   */
  async count() {
    await this._load()
    return this._papers.length
  }

  /**
   * Clear all data.
   */
  async clear() {
    this._papers = []
    await this._save()
  }
}

/**
 * Cosine similarity between two Float32Arrays.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Close the store.
 */
export async function closeStore() {
  _db = null
  _table = null
}