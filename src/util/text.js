/**
 * Text Utilities
 *
 * PRESERVED from v0.1.0 architecture.
 * Smart text truncation that preserves head and tail content.
 */

/**
 * Truncate text to maxChars while preserving a meaningful head and tail.
 * For long texts, inserts a marker and splits 60/40.
 *
 * @param {string} value — Text to truncate
 * @param {number} maxChars — Maximum characters
 * @returns {{ text: string, truncated: boolean }}
 */
export function truncateText(value, maxChars) {
  const text = String(value ?? '')
  if (!Number.isInteger(maxChars) || maxChars < 1) {
    throw new TypeError('maxChars must be a positive integer')
  }
  if (text.length <= maxChars) return { text, truncated: false }
  if (maxChars <= 32) return { text: text.slice(0, maxChars), truncated: true }

  const marker = '\n…[truncated]…\n'
  const budget = maxChars - marker.length
  const head = Math.ceil(budget * 0.6)
  const tail = budget - head
  return {
    text: text.slice(0, head) + marker + text.slice(text.length - tail),
    truncated: true,
  }
}

/**
 * Sanitize a string for safe display (remove control characters).
 */
export function sanitizeText(value) {
  return String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
}

/**
 * Wrap text to a maximum line width.
 */
export function wrapText(text, width = 80) {
  const words = String(text ?? '').split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current.trim())
      current = word
    } else {
      current += ' ' + word
    }
  }
  if (current.trim()) lines.push(current.trim())
  return lines.join('\n')
}