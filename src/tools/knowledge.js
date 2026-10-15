/**
 * th_msm_knowledge — Query the TH-MSM knowledge base.
 *
 * v1.2 final: 直接读取 papers.json 做关键词匹配，无 retriever/store 依赖。
 * 中→英自动映射，零外部依赖，保证 DSH 安装即用。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Schema ───────────────────────────────────────────────────

const resultSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    query: { type: 'string', required: true },
    totalResults: { type: 'integer', required: true },
    results: {
      type: 'array', required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          authors: { type: 'string' },
          journal: { type: 'string' },
          year: { type: 'integer' },
          keywords: { type: 'array', items: { type: 'string' } },
          level: { type: 'array', items: { type: 'string' } },
          topic: { type: 'string' },
          relevance: { type: 'number' },
          score: { type: 'number' },
        },
      },
    },
    suggestion: { type: 'string' },
    indexHint: { type: 'string' },
  },
}

// ── 中→英映射表 ─────────────────────────────────────────────

const CN_EN_MAP = {
  'msm': 'msm',
  '马尔可夫': 'markov', '马尔科夫': 'markov',
  '状态模型': 'state model',
  '蛋白质': 'protein', '动力学': 'dynamics kinetics',
  '构象': 'conformation conformational', '折叠': 'folding',
  '降维': 'dimensionality reduction', '聚类': 'clustering',
  '理论': 'theory', '验证': 'validation',
  '转移': 'transition', '矩阵': 'matrix',
  '隐含时间': 'implied timescale its', '时间尺度': 'timescale its',
  'koopman': 'koopman', '变分': 'variational vamp',
  'tica': 'tica', 'pca': 'pca', 'pcca': 'pcca',
  '宏态': 'macrostate metastable', '微态': 'microstate',
  '采样': 'sampling', '增强': 'enhanced', '自适应': 'adaptive',
  '神经网络': 'neural network deep', '深度学习': 'deep learning',
  '配体': 'ligand binding', '结合': 'binding',
  '自由能': 'free energy', '通量': 'flux', '路径': 'path pathway',
  '分子模拟': 'molecular simulation md', '轨迹': 'trajectory',
  '应用': 'application', '综述': 'review',
  '方法': 'method methodology', '误差': 'error uncertainty',
  '贝叶斯': 'bayesian', '特征': 'feature featurization',
  '选择': 'selection', '距离': 'distance',
  '二面角': 'dihedral torsion', '稳态': 'stationary', '平衡': 'equilibrium',
}

// ── 工具定义 ─────────────────────────────────────────────────

export function createKnowledgeTool(ctx, config) {
  let _papers = null

  function loadPapers() {
    if (_papers) return _papers
    try {
      // 从插件自身目录加载 papers.json
      const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
      const papersPath = path.join(pluginDir, 'knowledge', 'vector', 'papers.json')
      if (existsSync(papersPath)) {
        const db = JSON.parse(readFileSync(papersPath, 'utf8'))
        _papers = db.chunks ?? []
      }
    } catch { /* ignore */ }
    if (!_papers) _papers = []
    return _papers
  }

  return defineTool({
    name: 'th_msm_knowledge',
    description:
      '查询 TH-MSM 内置知识库，使用关键词匹配与中文关键词映射。' +
      '可按主题 (theory/dim-reduction/clustering/msm-construction/validation/enhanced-sampling/deep-msm/applications) 和水平 (undergraduate/graduate/expert) 过滤。',
    parameters: {
      query: { type: 'string', description: '搜索关键词，支持自然语言（如 "tICA 降维方法的原理"）。' },
      topic: { type: 'string', description: '按主题过滤（可选）。' },
      level: { type: 'string', enum: ['undergraduate', 'graduate', 'expert'], description: '按学习水平过滤（可选）。' },
      maxResults: { type: 'integer', description: `最大结果数（默认 10）。` },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `查询失败: ${value.suggestion}` }]
        const lines = [`找到 ${value.totalResults} 条关于 "${value.query}" 的结果:`]
        for (const r of value.results) {
          lines.push(`**${r.title}** — ${r.authors} — *${r.journal}* (${r.year ?? 'N/A'})`)
          lines.push(`  Topic: ${r.topic ?? 'N/A'} | Keywords: ${(r.keywords ?? []).join(', ')} | 相关度: ${((r.relevance ?? 0) * 100).toFixed(0)}%`)
          lines.push('')
        }
        if (value.totalResults === 0) lines.push(value.suggestion)
        if (value.indexHint) lines.push(value.indexHint)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: config.defaultTimeoutMs,
    isConcurrencySafe: () => true,

    async execute(args) {
      const query = String(args.query ?? '')
      const maxResults = args.maxResults ?? 10
      const papers = loadPapers()

      if (!query || papers.length === 0) {
        return {
          ok: true, query, totalResults: 0, results: [],
          suggestion: papers.length === 0
            ? '知识库未加载。请确认 papers.json 在插件目录中。'
            : '请输入搜索关键词。',
          indexHint: '',
        }
      }

      // ── 分词 + 中→英映射 ────────────────────────────────
      const tokens = tokenize(query)

      // ── 打分 + 过滤 ──────────────────────────────────────
      const scored = papers
        .filter(p => {
          if (args.topic && p.topic !== args.topic) return false
          if (args.level && !(p.level ?? []).some(l => l === args.level)) return false
          return true
        })
        .map(p => {
          const titleLower = (p.title ?? '').toLowerCase()
          const kwLower = (p.keywords ?? []).join(' ').toLowerCase()
          const textLower = (p.text ?? '').toLowerCase()
          let score = 0
          for (const t of tokens) {
            const tl = t.toLowerCase()
            if (titleLower.includes(tl)) score += 0.5
            if (kwLower.includes(tl)) score += 0.3
            if (textLower.includes(tl)) score += 0.1
          }
          return {
            id: String(p.id ?? ''),
            title: String(p.title ?? ''),
            authors: String(p.authors ?? ''),
            journal: String(p.journal ?? ''),
            year: Number.isFinite(p.year) ? p.year : 0,
            keywords: Array.isArray(p.keywords) ? p.keywords : [],
            level: Array.isArray(p.level) ? p.level : [],
            topic: String(p.topic ?? ''),
            relevance: score,
            score,
          }
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)

      if (scored.length === 0) {
        return {
          ok: true, query, totalResults: 0, results: [],
          suggestion: `没有找到 "${query}" 相关结果。试试英文关键词或短词搜索。`,
          indexHint: '',
        }
      }

      return {
        ok: true, query, totalResults: scored.length, results: scored,
        suggestion: '', indexHint: '',
      }
    },
  })
}

// ── 分词 + 中→英映射 ──────────────────────────────────────

function tokenize(text) {
  if (!text) return []
  const tokens = []
  const textLower = text.toLowerCase()

  // 英文词
  const enWords = textLower.match(/[a-z]{2,}/g) || []
  for (const w of enWords) tokens.push(w)

  // 中文词 → 英文映射
  for (const [cn, en] of Object.entries(CN_EN_MAP)) {
    if (textLower.includes(cn)) {
      for (const ew of en.split(/\s+/)) tokens.push(ew)
    }
  }

  // 中文单字/双字组合也保留
  const cnChars = textLower.match(/[\u4e00-\u9fff]+/g) || []
  for (const cn of cnChars) {
    tokens.push(cn)
    for (let i = 0; i < cn.length - 1; i++) {
      tokens.push(cn.slice(i, i + 2))
    }
  }

  return [...new Set(tokens.filter(t => t.length >= 2))]
}
