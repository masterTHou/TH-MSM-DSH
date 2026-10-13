/**
 * CATALOG.md Parser
 *
 * Parses TH-MSM knowledge base CATALOG.md files.
 * Expected format: Markdown with embedded YAML blocks.
 *
 * Example YAML entry:
 * ```yaml
 * - id: P001
 *   title: "Markov models of molecular kinetics"
 *   authors: "Prinz et al."
 *   journal: "J. Chem. Phys., 134, 174105 (2011)"
 *   doi: "10.1063/1.3565032"
 *   keywords: ["MSM", "theory", "transition matrix"]
 *   level: [graduate, expert]
 *   topic: "theory"
 *   filename: "P001_prinz_msm_theory.pdf"
 * ```
 */

/**
 * Parse a CATALOG.md file and extract paper entries.
 *
 * Strategy:
 * 1. Find YAML code blocks (```yaml ... ```)
 * 2. Parse each as a list of paper objects
 * 3. Validate required fields: id, title
 * 4. Return normalized array
 *
 * @param {string} content — Raw CATALOG.md content
 * @param {string} source — Source file path (for error messages)
 * @returns {object[]} Array of paper entries
 */
export function parseCatalog(content, source = 'unknown') {
  const entries = []

  // Extract YAML code blocks
  const yamlBlockRe = /```ya?ml\s*\n([\s\S]*?)```/g
  let match
  while ((match = yamlBlockRe.exec(content)) !== null) {
    const yamlText = match[1]
    try {
      const parsed = parseYamlEntries(yamlText, source)
      entries.push(...parsed)
    } catch (error) {
      // Skip malformed blocks — catalog is best-effort
      console.warn(`TH-MSM: Skipping malformed YAML block in ${source}: ${error.message}`)
    }
  }

  return entries
}

/**
 * Parse a YAML string into paper entries.
 * This is a minimal YAML parser for the catalog format.
 * For production, use a full YAML library.
 */
function parseYamlEntries(yamlText, source) {
  const entries = []
  const lines = yamlText.split('\n')
  let current = null

  for (const line of lines) {
    const trimmed = line.trim()

    // New entry: "- id: ..."
    if (trimmed.startsWith('- id:')) {
      if (current) entries.push(normalizeEntry(current, source))
      current = {}
      current.id = extractValue(trimmed, 'id')
    } else if (current && trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':')
      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()

      if (key === 'title') {
        // Strip quotes
        current.title = value.replace(/^["']|["']$/g, '')
      } else if (key === 'authors') {
        current.authors = value.replace(/^["']|["']$/g, '')
      } else if (key === 'journal') {
        current.journal = value.replace(/^["']|["']$/g, '')
      } else if (key === 'doi') {
        current.doi = value.replace(/^["']|["']$/g, '')
      } else if (key === 'keywords') {
        current.keywords = parseList(value)
      } else if (key === 'level') {
        current.level = parseList(value)
      } else if (key === 'topic') {
        current.topic = value.replace(/^["']|["']$/g, '')
      } else if (key === 'filename') {
        current.filename = value.replace(/^["']|["']$/g, '')
      } else if (key === 'year') {
        current.year = parseInt(value, 10) || undefined
      } else if (key === 'abstract') {
        current.abstract = value.replace(/^["']|["']$/g, '')
      } else if (key === 'name') {
        // Benchmark entries use 'name' instead of 'title'
        current.title = value.replace(/^["']|["']$/g, '')
        current.name = value.replace(/^["']|["']$/g, '')
      } else if (key === 'type') {
        if (value.startsWith('[')) {
          current.type = parseList(value)
        } else {
          current.type = [value.replace(/^["']|["']$/g, '')]
        }
      } else if (key === 'n_atoms') {
        current.nAtoms = parseInt(value, 10) || undefined
      } else if (key === 'description') {
        current.description = value.replace(/^["']|["']$/g, '')
      } else if (key === 'known_dynamics') {
        current.knownDynamics = value.replace(/^["']|["']$/g, '')
      } else if (key === 'typical_timescales') {
        current.typicalTimescales = value.replace(/^["']|["']$/g, '')
      }
    }
  }

  if (current) entries.push(normalizeEntry(current, source))

  return entries
}

function extractValue(line, key) {
  // Remove "- key:" prefix and any quotes
  const afterColon = line.slice(line.indexOf(`${key}:`) + key.length + 1).trim()
  return afterColon.replace(/^["']|["']$/g, '')
}

function parseList(value) {
  // Parse YAML list: [a, b, c] or just a bare string
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
  }
  return [trimmed.replace(/^['"]|['"]$/g, '')]
}

function normalizeEntry(raw, source) {
  const entry = {
    id: raw.id ?? `unknown-${Date.now()}`,
    title: raw.title ?? 'Untitled',
    authors: raw.authors ?? 'Unknown',
    journal: raw.journal ?? '',
    doi: raw.doi ?? '',
    year: raw.year ?? null,
    keywords: raw.keywords ?? [],
    level: raw.level ?? ['graduate'],
    topic: raw.topic ?? 'general',
    filename: raw.filename ?? '',
    source,
  }

  // Benchmark-specific fields
  if (raw.type) entry.type = raw.type
  if (raw.name && !entry.title) entry.title = raw.name
  if (raw.nAtoms) entry.nAtoms = raw.nAtoms
  if (raw.description) entry.description = raw.description
  if (raw.knownDynamics) entry.knownDynamics = raw.knownDynamics
  if (raw.typicalTimescales) entry.typicalTimescales = raw.typicalTimescales

  return entry
}