/**
 * Vector Store — 纯 JSON 文件向量存储
 *
 * v1.1 简化方案：
 *   - 预构建向量文件: .th-msm/vector/papers.json（打包在 tgz 中）
 *   - 零外部依赖：无需 LanceDB、无需 transformers
 *   - 查询时纯 JS cosine 相似度，毫秒级返回
 *   - 新增论文：在用户终端运行 npm run embed 更新
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

let _store = null

/**
 * 加载向量存储（单例）
 */
export async function openStore(workspace) {
  if (_store) return _store

  // Priority 1: .th-msm/vector/papers.json（用户构建的）
  const userPath = path.join(workspace, '.th-msm', 'vector', 'papers.json')
  // Priority 2: prebuilt/vector-db.json（预打包的，作为 fallback）
  const prebuiltPath = path.join(workspace, 'node_modules', '@th-msm', 'dsh-plugin', 'prebuilt', 'vector-db.json')

  let dataPath = null
  if (existsSync(userPath)) {
    dataPath = userPath
  } else if (existsSync(prebuiltPath)) {
    dataPath = prebuiltPath
  }

  if (dataPath) {
    try {
      const raw = readFileSync(dataPath, 'utf8')
      const db = JSON.parse(raw)
      _store = new StaticVectorStore(db)
      return _store
    } catch {
      // 文件损坏，降级到空存储
    }
  }

  _store = new StaticVectorStore({ chunks: [] })
  return _store
}

class StaticVectorStore {
  constructor(db) {
    this._chunks = db.chunks ?? []
    this._model = db.model ?? 'unknown'
    this._dimension = db.dimension ?? 0
    this._total = db.total ?? this._chunks.length
  }

  async count() {
    return this._chunks.length
  }

  async search(queryVector, opts = {}) {
    const { limit = 10, minScore = 0.3, filterSource, filterTopic } = opts

    const candidates = this._chunks.filter(c => {
      if (filterSource && c.source !== filterSource) return false
      if (filterTopic && c.topic !== filterTopic) return false
      return true
    })

    const scored = candidates.map(c => ({
      id: c.id,
      text: c.text,
      score: c.vector ? cosineSimilarity(queryVector, c.vector) : 0,
      metadata: {
        id: c.id,
        title: c.title,
        authors: c.authors,
        year: c.year,
        journal: c.journal,
        keywords: c.keywords,
        topic: c.topic,
        level: c.level,
        source: c.source,
      },
    }))

    return scored
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  async get(id) {
    return this._chunks.find(c => c.id === id) ?? null
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function closeStore() {
  _store = null
}