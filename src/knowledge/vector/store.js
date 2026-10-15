/**
 * Vector Store — 纯 JSON 文件向量存储
 *
 * v1.2: 预构建向量文件优先从插件自身目录加载（tgz 内打包），
 *       用户构建的覆盖在 .th-msm/vector/ 下。
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeWorkspaceText } from '../../io/workspace.js'

const stores = new Map()

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
  const key = path.resolve(workspace)
  if (stores.has(key)) return stores.get(key)

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
      const store = new StaticVectorStore(db, workspace)
      stores.set(key, store)
      return store
    } catch (e) {
      // 文件损坏，降级到空存储
    }
  }

  const store = new StaticVectorStore({ chunks: [] }, workspace)
  stores.set(key, store)
  return store
}

class StaticVectorStore {
  constructor(db, workspace) {
    this.workspace = workspace
    this._chunks = db.chunks ?? []
    this._model = db.model ?? 'unknown'
    this._dimension = db.dimension ?? 0
    this._total = db.total ?? this._chunks.length
  }

  async count() {
    return this._chunks.length
  }
  async persist() {
    await writeWorkspaceText(this.workspace, '.th-msm/vector/papers.json', JSON.stringify({ model: this._model, dimension: this._dimension, chunks: this._chunks }))
  }
  async clear() { this._chunks = []; this._model = 'unknown'; this._dimension = 0; await this.persist() }
  async upsert(rows) {
    const saved = { chunks: this._chunks, dimension: this._dimension, model: this._model }
    this._chunks = structuredClone(this._chunks)
    try {
    for (const row of rows) {
      const vector = Array.from(row.vector)
      if (!vector.length || vector.some(x => !Number.isFinite(x))) throw new Error('invalid vector')
      if (this._dimension && this._dimension !== vector.length) throw new Error('embedding dimension mismatch; rebuild with one model')
      this._dimension = vector.length; this._model = row.model ?? 'Xenova/all-MiniLM-L6-v2'
      const item = { ...JSON.parse(row.metadata), id: row.id, text: row.text, vector }, i = this._chunks.findIndex(x => x.id === row.id)
      if (i >= 0) this._chunks[i] = item; else this._chunks.push(item)
    }
    await this.persist()
    } catch (e) { this._chunks = saved.chunks; this._dimension = saved.dimension; this._model = saved.model; throw e }
  }
  async replace(rows) {
    const saved = { chunks: this._chunks, dimension: this._dimension, model: this._model }
    this._chunks = []; this._dimension = 0; this._model = 'unknown'
    try { await this.upsert(rows) }
    catch (e) { this._chunks = saved.chunks; this._dimension = saved.dimension; this._model = saved.model; throw e }
  }

  async search(queryVector, opts = {}) {
    if (queryVector.length !== this._dimension) throw new Error('embedding dimension mismatch; use keyword retrieval or rebuild with matching model')
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
 * 分词：中英文混合 + 中→英自动翻译。
 * 英文按空格/标点分词，中文提取连续中文字符序列并映射到英文关键词。
 */
function tokenize(text) {
  if (!text) return []
  const tokens = []
  // 提取中文词（2-4字连续序列）
  const cnChars = text.match(/[\u4e00-\u9fff]+/g) || []
  const hasChinese = cnChars.length > 0

  for (const cn of cnChars) {
    for (let i = 0; i < cn.length; i++) {
      tokens.push(cn.slice(i, i + 2))
      if (i + 3 <= cn.length) tokens.push(cn.slice(i, i + 3))
    }
    tokens.push(cn)
  }

  // 中→英映射：中文词组翻译为英文关键词
  if (hasChinese) {
    const textLower = text.toLowerCase()
    for (const [cnPattern, enWord] of Object.entries(CN_EN_MAP)) {
      if (textLower.includes(cnPattern)) {
        tokens.push(enWord)
      }
    }
  }

  // 提取英文词
  const enWords = text.match(/[a-zA-Z]{2,}/g) || []
  for (const w of enWords) {
    tokens.push(w)
  }
  // 去重
  return [...new Set(tokens.filter(t => t.length >= 2))]
}

/**
 * 中→英关键词映射表。
 * 当用户用中文搜索时，自动追加英文对应词以匹配英文论文。
 */
const CN_EN_MAP = {
  'msm': 'msm',
  '马尔可夫': 'markov',
  '马尔科夫': 'markov',
  '状态模型': 'state model',
  '蛋白质': 'protein',
  '动力学': 'dynamics kinetics',
  '构象': 'conformation conformational',
  '折叠': 'folding',
  '降维': 'dimensionality reduction',
  '聚类': 'clustering',
  '理论': 'theory',
  '验证': 'validation',
  '转移': 'transition',
  '矩阵': 'matrix',
  '隐含时间': 'implied timescale its',
  '时间尺度': 'timescale its',
  'its': 'its implied timescale',
  'koopman': 'koopman',
  '变分': 'variational vamp',
  'vamp': 'vamp variational',
  'tica': 'tica',
  'pca': 'pca',
  'pcca': 'pcca',
  '宏态': 'macrostate metastable',
  '微态': 'microstate',
  '采样': 'sampling',
  '增强': 'enhanced',
  '自适应': 'adaptive',
  '神经网络': 'neural network deep',
  '深度学习': 'deep learning',
  '配体': 'ligand binding',
  '结合': 'binding',
  '自由能': 'free energy',
  '通量': 'flux',
  '路径': 'path pathway',
  '分子模拟': 'molecular simulation md',
  '轨迹': 'trajectory',
  '应用': 'application',
  '综述': 'review',
  '方法': 'method methodology',
  '误差': 'error uncertainty',
  '贝叶斯': 'bayesian',
  '特征': 'feature featurization',
  '选择': 'selection',
  '距离': 'distance',
  '二面角': 'dihedral torsion',
  '接触图': 'contact',
  '稳态': 'stationary',
  '平衡': 'equilibrium',
}

export async function closeStore() {
  stores.clear()
}
