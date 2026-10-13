/**
 * Vector Store — 纯 JSON 文件向量存储
 *
 * v1.2: 预构建向量文件优先从插件自身目录加载（tgz 内打包），
 *       用户构建的覆盖在 .th-msm/vector/ 下。
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let _store = null

/**
 * 获取插件自身的安装目录（tgz 解压后的位置）。
 */
function getPluginDir() {
  const __filename = fileURLToPath(import.meta.url)
  // src/knowledge/vector/store.js → 往上 3 级到插件根目录
  return path.resolve(path.dirname(__filename), '..', '..', '..')
}

/**
 * 加载向量存储（单例）
 */
export async function openStore(workspace) {
  if (_store) return _store

  // Priority 1: .th-msm/vector/papers.json（用户自己构建的）
  const userPath = path.join(workspace, '.th-msm', 'vector', 'papers.json')
  // Priority 2: 插件内置的预构建向量（tgz 自带）
  const pluginDir = getPluginDir()
  const builtinPath = path.join(pluginDir, 'src', 'knowledge', 'vector', 'papers.json')

  let dataPath = null
  if (existsSync(userPath)) {
    dataPath = userPath
  } else if (existsSync(builtinPath)) {
    dataPath = builtinPath
  }

  if (dataPath) {
    try {
      const raw = readFileSync(dataPath, 'utf8')
      const db = JSON.parse(raw)
      _store = new StaticVectorStore(db)
      return _store
    } catch (e) {
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

  /**
   * 纯文本搜索 — 不依赖向量模型。
   * 将查询分词后对每个 chunk 的 text 字段做关键词匹配和打分。
   */
  async searchByText(query, opts = {}) {
    const { limit = 10, filterSource, filterTopic, filterLevel } = opts

    // 分词：中文按字符+词组，英文按空格
    const queryTokens = tokenize(query)
    if (queryTokens.length === 0) return []

    let candidates = this._chunks.filter(c => {
      if (filterSource && c.source !== filterSource) return false
      if (filterTopic && c.topic !== filterTopic) return false
      if (filterLevel) {
        const levels = c.level || []
        if (!levels.some(l => l.toLowerCase() === filterLevel.toLowerCase())) return false
      }
      return true
    })

    // 对每个候选打分
    const scored = candidates.map(c => {
      const textLower = (c.text || '').toLowerCase()
      const titleLower = (c.title || '').toLowerCase()
      const kwLower = (c.keywords || []).join(' ').toLowerCase()

      let score = 0
      for (const token of queryTokens) {
        const t = token.toLowerCase()
        if (titleLower.includes(t)) score += 0.5
        if (kwLower.includes(t)) score += 0.3
        if (textLower.includes(t)) score += 0.1
      }
      // 归一化
      score = Math.min(score / (queryTokens.length * 0.5), 1)

      return {
        id: c.id,
        text: c.text,
        score,
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
      }
    })

    return scored
      .filter(r => r.score > 0)
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

/**
 * 分词：中英文混合。
 * 英文按空格/标点分词，中文提取连续中文字符序列。
 */
function tokenize(text) {
  if (!text) return []
  const tokens = []
  // 提取中文词（2-4字连续序列）
  const cnChars = text.match(/[\u4e00-\u9fff]+/g) || []
  for (const cn of cnChars) {
    for (let i = 0; i < cn.length; i++) {
      tokens.push(cn.slice(i, i + 2))
      if (i + 3 <= cn.length) tokens.push(cn.slice(i, i + 3))
    }
    tokens.push(cn)
  }
  // 提取英文词
  const enWords = text.match(/[a-zA-Z]{2,}/g) || []
  for (const w of enWords) {
    tokens.push(w)
  }
  // 去重
  return [...new Set(tokens.filter(t => t.length >= 2))]
}

export async function closeStore() {
  _store = null
}