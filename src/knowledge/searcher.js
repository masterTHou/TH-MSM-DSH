/**
 * Knowledge Base Searcher
 *
 * Full-text search across indexed papers with keyword, topic,
 * and level filtering. Uses simple TF-like relevance scoring.
 */

/**
 * Search the knowledge base.
 *
 * @param {object} kb — Loaded knowledge base ({ papers, benchmarks })
 * @param {object} opts — Search options
 * @param {string} opts.query — Search query
 * @param {string} [opts.topic] — Topic filter
 * @param {string} [opts.level] — Level filter
 * @param {number} [opts.maxResults] — Max results (default 10)
 * @returns {object[]} Ranked results with relevance scores
 */
export function searchKnowledge(kb, opts = {}) {
  const { query, topic, level, maxResults = 10 } = opts

  const candidates = kb.papers ?? []

  // Score each paper
  const scored = candidates.map(paper => ({
    ...paper,
    relevance: scorePaper(paper, query, topic, level),
  }))

  // Filter zero-relevance
  const relevant = scored.filter(p => p.relevance > 0)

  // Sort by relevance descending
  relevant.sort((a, b) => b.relevance - a.relevance)

  return relevant.slice(0, maxResults)
}

/**
 * Score a paper against search criteria.
 * Returns a number 0-1 where 1 is a perfect match.
 */
function scorePaper(paper, query, topic, level) {
  if (!query && !topic && !level) return 0.5

  let score = 0

  // Query scoring (weight: 0.5)
  if (query) {
    const queryLower = query.toLowerCase()
    const queryTokens = tokenize(queryLower)
    let queryScore = 0

    // Title match
    if (paper.title?.toLowerCase().includes(queryLower)) {
      queryScore += 0.4
    }
    // Keyword match
    if (paper.keywords?.some(kw => queryLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(queryLower))) {
      queryScore += 0.3
    }
    // Token-level match in title
    const titleTokens = tokenize(paper.title?.toLowerCase() ?? '')
    const tokenOverlap = queryTokens.filter(t => titleTokens.includes(t)).length
    if (tokenOverlap > 0) {
      queryScore += 0.2 * (tokenOverlap / Math.max(queryTokens.length, 1))
    }
    // Authors match
    if (paper.authors?.toLowerCase().includes(queryLower)) {
      queryScore += 0.1
    }

    score += 0.5 * Math.min(queryScore, 1)
  }

  // Topic filter (weight: 0.3)
  if (topic) {
    if (paper.topic?.toLowerCase() === topic.toLowerCase()) {
      score += 0.3
    } else if (paper.keywords?.some(kw => kw.toLowerCase() === topic.toLowerCase())) {
      score += 0.2
    }
  } else {
    score += 0.3 // No topic filter = full credit
  }

  // Level filter (weight: 0.2)
  if (level) {
    if (paper.level?.some(l => l.toLowerCase() === level.toLowerCase())) {
      score += 0.2
    }
  } else {
    score += 0.2 // No level filter = full credit
  }

  return Math.min(score, 1)
}

/**
 * Tokenize a string for search.
 */
function tokenize(text) {
  return text
    .split(/[\s,;:._-]+/)
    .filter(t => t.length > 1)
}

/**
 * Find papers citing a specific concept.
 */
export function findPapersByConcept(kb, concept) {
  return searchKnowledge(kb, { query: concept })
}

/**
 * Get papers at a specific learning level.
 */
export function getPapersByLevel(kb, level) {
  return (kb.papers ?? []).filter(p =>
    p.level?.some(l => l.toLowerCase() === level.toLowerCase())
  )
}

/**
 * Get papers by topic.
 */
export function getPapersByTopic(kb, topic) {
  return (kb.papers ?? []).filter(p =>
    p.topic?.toLowerCase() === topic.toLowerCase() ||
    p.keywords?.some(kw => kw.toLowerCase() === topic.toLowerCase())
  )
}

/**
 * List all available topics from the knowledge base.
 */
export function listTopics(kb) {
  const topics = new Set()
  for (const paper of kb.papers ?? []) {
    if (paper.topic) topics.add(paper.topic.toLowerCase())
    for (const kw of paper.keywords ?? []) topics.add(kw.toLowerCase())
  }
  return [...topics].sort()
}