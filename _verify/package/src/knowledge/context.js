/**
 * Knowledge Context — Format knowledge base results for prompt injection.
 *
 * This module converts search results into LLM-friendly context snippets
 * that can be injected into the system prompt or tool responses.
 */

/**
 * Format a single knowledge result for display.
 *
 * @param {object} result — Search result from searcher.js
 * @returns {string} Formatted text line
 */
export function formatKnowledgeResult(result) {
  const parts = [
    `**${result.title}**`,
    result.authors ? ` — ${result.authors}` : '',
    result.journal ? ` — *${result.journal}*` : '',
    result.year ? ` (${result.year})` : '',
  ]
  const header = parts.join('')

  const meta = []
  if (result.topic) meta.push(`Topic: ${result.topic}`)
  if (result.level?.length) meta.push(`Level: ${result.level.join('/')}`)
  if (result.keywords?.length) meta.push(`Keywords: ${result.keywords.join(', ')}`)
  if (result.relevance !== undefined) meta.push(`Relevance: ${(result.relevance * 100).toFixed(0)}%`)

  return `${header}\n  ${meta.join(' | ')}`
}

/**
 * Format multiple results as a knowledge context block for prompt injection.
 *
 * @param {object[]} results — Array of search results
 * @param {string} query — Original query
 * @returns {string} Context block for system prompt
 */
export function formatKnowledgeContext(results, query) {
  if (!results.length) return ''

  const lines = [
    `[TH-MSM Knowledge Base: ${results.length} results for "${query}"]`,
    '',
  ]

  for (let i = 0; i < Math.min(results.length, 5); i++) {
    lines.push(`${i + 1}. ${formatKnowledgeResult(results[i])}`)
    lines.push('')
  }

  if (results.length > 5) {
    lines.push(`... and ${results.length - 5} more results.`)
  }

  return lines.join('\n')
}

/**
 * Build a complete system prompt enrichment from knowledge base.
 *
 * @param {object} kb — Loaded knowledge base
 * @param {string} intent — Detected intent mode
 * @param {object} details — Intent details
 * @returns {string} System prompt enrichment
 */
export function buildKnowledgeEnrichment(kb, intent, details) {
  const parts = []

  // Add relevant papers
  if (intent === 'teaching' && details.concept) {
    const results = searchPapersForConcept(kb, details.concept, 3)
    if (results.length) {
      parts.push(formatKnowledgeContext(results, details.concept))
    }
  }

  if (intent === 'planning' && (details.systemType || details.goal)) {
    const query = [details.systemType, details.goal].filter(Boolean).join(' ')
    const results = searchPapersForConcept(kb, query, 3)
    if (results.length) {
      parts.push(formatKnowledgeContext(results, query))
    }
  }

  // Add learning roadmap reference
  if (intent === 'teaching' && details.level) {
    parts.push(
      `[Learning Path: See knowledge/LEARNING_ROADMAP.md for the ${details.level}-level path.]`
    )
  }

  return parts.join('\n\n')
}

// Re-export from searcher for convenience
import { searchKnowledge } from './searcher.js'

function searchPapersForConcept(kb, concept, maxResults) {
  return searchKnowledge(kb, { query: concept, maxResults })
}