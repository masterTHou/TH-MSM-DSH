/**
 * th_msm_knowledge — Query the TH-MSM knowledge base.
 *
 * Searches indexed papers, reviews, and benchmarks by keyword, topic,
 * or level. Returns structured paper metadata and relevance scores.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { loadKnowledgeBase } from '../knowledge/loader.js'
import { searchKnowledge } from '../knowledge/searcher.js'
import { formatKnowledgeResult } from '../knowledge/context.js'

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
        },
      },
    },
    suggestion: { type: 'string' },
  },
}

export function createKnowledgeTool(ctx, config) {
  // Lazy-loaded cache
  let _kb = null

  async function ensureKB(workspace) {
    if (_kb) return _kb
    const basePath = config.knowledgeBasePath
    const catalogs = config.knowledgeCatalogs
    _kb = await loadKnowledgeBase(workspace, basePath, catalogs)
    return _kb
  }

  return defineTool({
    name: 'th_msm_knowledge',
    description:
      'Query the TH-MSM knowledge base for papers, reviews, and benchmark systems. ' +
      'Supports search by keyword, topic (featurization/dim-reduction/clustering/msm-construction/validation/coarse-graining/enhanced-sampling/deep-msm/theory/applications), ' +
      'and level (undergraduate/graduate/expert).',
    parameters: {
      query: {
        type: 'string',
        description: 'Search query. Can be keywords, topic name, or free text.',
      },
      topic: {
        type: 'string',
        description: 'Filter by topic category (optional).',
      },
      level: {
        type: 'string',
        enum: ['undergraduate', 'graduate', 'expert'],
        description: 'Filter by learning level (optional).',
      },
      maxResults: {
        type: 'integer',
        description: `Maximum results to return (default: ${config.maxKnowledgeResults}).`,
      },
    },
    output: {
      schema: resultSchema,
      render: (_args, value) => {
        if (!value.ok) return [{ type: 'text', text: `Knowledge query failed: ${value.suggestion}` }]
        const lines = [`Found ${value.totalResults} results for "${value.query}":`]
        for (const r of value.results) {
          lines.push(formatKnowledgeResult(r))
          lines.push('')
        }
        if (value.totalResults === 0) lines.push(value.suggestion)
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
          suggestion: 'No agent workspace is available.',
        }
      }

      try {
        const kb = await ensureKB(workspace)
        const results = searchKnowledge(kb, {
          query: args.query ?? '',
          topic: args.topic,
          level: args.level,
          maxResults: args.maxResults ?? config.maxKnowledgeResults,
        })

        if (results.length === 0) {
          // Try similar queries
          const suggestions = suggestQueries(kb, args.query ?? '')
          return {
            ok: true, query: args.query ?? '', totalResults: 0, results: [],
            suggestion: suggestions.length
              ? `No exact matches. Try: ${suggestions.join(', ')}. Or add papers to knowledge/${kb.catalogs[0].split('/')[0]}/.`
              : 'No results found. Consider adding relevant papers to the knowledge base.',
          }
        }

        return {
          ok: true,
          query: args.query ?? '',
          totalResults: results.length,
          results,
          suggestion: '',
        }
      } catch (error) {
        return {
          ok: false, query: args.query ?? '', totalResults: 0, results: [],
          suggestion: `Knowledge base error: ${error.message}`,
        }
      }
    },
  })
}

/**
 * Suggest alternative queries based on partial matches in the index.
 */
function suggestQueries(kb, query) {
  const q = query.toLowerCase()
  const allKeywords = new Set()
  for (const paper of kb.papers) {
    for (const kw of paper.keywords) {
      allKeywords.add(kw.toLowerCase())
    }
  }

  const matches = [...allKeywords]
    .filter(kw => kw.includes(q) || q.includes(kw))
    .slice(0, 5)
  return matches
}