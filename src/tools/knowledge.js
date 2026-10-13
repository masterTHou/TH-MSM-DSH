/**
 * th_msm_knowledge — Query the TH-MSM knowledge base.
 *
 * v1.1: 混合检索。向量索引存在时自动走 RAG，否则降级为关键词匹配。
 * 首次查询时若索引未构建，会在结果末尾提示用户一键升级。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { loadKnowledgeBase } from '../knowledge/loader.js'
import { searchKnowledge } from '../knowledge/searcher.js'
import { formatKnowledgeResult } from '../knowledge/context.js'
import { getRetriever } from '../knowledge/vector/retriever.js'

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
        additionalProperties: true,
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
          source: { type: 'string' },
          text: { type: 'string' },
          vectorScore: { type: 'number' },
          keywordScore: { type: 'number' },
        },
      },
    },
    suggestion: { type: 'string' },
    indexHint: { type: 'string' },
  },
}

export function createKnowledgeTool(ctx, config) {
  let _kb = null

  async function ensureKB(workspace) {
    if (_kb) return _kb
    _kb = await loadKnowledgeBase(workspace, config.knowledgeBasePath, config.knowledgeCatalogs)
    return _kb
  }

  return defineTool({
    name: 'th_msm_knowledge',
    description:
      '查询 TH-MSM 知识库，支持语义搜索和关键词搜索。' +
      '可按主题 (theory/dim-reduction/clustering/msm-construction/validation/enhanced-sampling/deep-msm/applications) 和水平 (undergraduate/graduate/expert) 过滤。',
    parameters: {
      query: {
        type: 'string',
        description: '搜索关键词，支持自然语言（如 "tICA 降维方法的原理"）。',
      },
      topic: {
        type: 'string',
        description: '按主题过滤（可选）。',
      },
      level: {
        type: 'string',
        enum: ['undergraduate', 'graduate', 'expert'],
        description: '按学习水平过滤（可选）。',
      },
      maxResults: {
        type: 'integer',
        description: `最大结果数（默认 ${config.maxKnowledgeResults}）。`,
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `查询失败: ${value.suggestion}` }]
        const lines = [`找到 ${value.totalResults} 条关于 "${value.query}" 的结果:`]
        for (const r of value.results) {
          lines.push(formatKnowledgeResult(r))
          lines.push('')
        }
        if (value.totalResults === 0) lines.push(value.suggestion)
        if (value.indexHint) lines.push(value.indexHint)
        return [{ type: 'text', text: lines.join('\n') }]
      },
    },
    timeoutMs: config.defaultTimeoutMs,
    isConcurrencySafe: () => true,

    async execute(args, exec) {
      const workspace = exec.agent?.session?.header?.cwd
      if (!workspace) {
        return {
          ok: false, query: args.query ?? '', totalResults: 0, results: [],
          suggestion: '未找到工作区路径。', indexHint: '',
        }
      }

      const query = args.query ?? ''
      const maxResults = args.maxResults ?? config.maxKnowledgeResults

      // ── 混合检索 ──────────────────────────────────────────
      let results = []
      let usedRag = false
      let indexReady = false

      try {
        const retriever = await getRetriever(workspace)
        indexReady = await retriever.isReady()
        if (indexReady) {
          results = await retriever.retrieve(query, {
            topK: maxResults,
            vectorWeight: 0.7,
            filterTopic: args.topic,
            filterLevel: args.level,
          })
          usedRag = true
        }
      } catch { /* fallback */ }

      if (!usedRag) {
        const kb = await ensureKB(workspace)
        results = searchKnowledge(kb, {
          query, topic: args.topic, level: args.level, maxResults,
        })
      }

      // ── 降级提示 ──────────────────────────────────────────
      const indexHint = !indexReady && results.length > 0
        ? '\n💡 想获得更精准的语义搜索结果？说「构建索引」即可一键升级（首次约需 30 秒）。'
        : ''

      if (results.length === 0) {
        const kb = await ensureKB(workspace)
        const suggestions = suggestQueries(kb, query)
        const upgradeNote = !indexReady
          ? '\n\n💡 首次使用？说「构建索引」来启用 AI 语义搜索，查得更准。'
          : ''
        return {
          ok: true, query, totalResults: 0, results: [],
          suggestion: (suggestions.length
            ? `没有精确匹配。试试: ${suggestions.join(', ')}。`
            : `没有找到 "${query}" 相关结果。`) + upgradeNote,
          indexHint: '',
        }
      }

      return {
        ok: true, query, totalResults: results.length, results,
        suggestion: '', indexHint,
      }
    },
  })
}

function suggestQueries(kb, query) {
  const q = query.toLowerCase()
  const allKeywords = new Set()
  for (const paper of kb.papers ?? []) {
    for (const kw of paper.keywords ?? []) allKeywords.add(kw.toLowerCase())
  }
  return [...allKeywords].filter(kw => kw.includes(q) || q.includes(kw)).slice(0, 5)
}