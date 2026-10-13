/**
 * Registry Loader — Load and validate workspace .th-msm/registry.json.
 *
 * PRESERVED from v0.1.0 architecture. Security-critical:
 *  - Lexical path escape check
 *  - Symlink realpath escape check
 *  - Name validation (alphanumeric, 1-64 chars)
 *  - Duplicate detection
 *  - Command length limit (4096 chars)
 *  - Entry limit (configurable, default 256)
 *  - Frozen immutable output
 */

import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

export const MSM_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

function isInside(root, candidate) {
  const rel = path.relative(root, candidate)
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel))
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
}

export function validateRegistry(raw, { maxEntries = 256 } = {}) {
  assertPlainObject(raw, 'registry')
  if (raw.version !== 1) throw new TypeError('registry.version must be 1')
  if (!Array.isArray(raw.msms)) throw new TypeError('registry.msms must be an array')
  if (raw.msms.length > maxEntries) {
    throw new RangeError(`registry has ${raw.msms.length} entries; limit is ${maxEntries}`)
  }

  const seen = new Set()
  const entries = raw.msms.map((item, index) => {
    assertPlainObject(item, `registry.msms[${index}]`)
    const { name, command } = item
    if (typeof name !== 'string' || !MSM_NAME_RE.test(name)) {
      throw new TypeError(`registry.msms[${index}].name is invalid`)
    }
    if (seen.has(name)) throw new TypeError(`duplicate MSM name: ${name}`)
    seen.add(name)
    if (typeof command !== 'string' || command.trim() === '') {
      throw new TypeError(`registry.msms[${index}].command must be a non-empty string`)
    }
    if (command.length > 4096) {
      throw new RangeError(`registry.msms[${index}].command is too long`)
    }

    const optionalText = (key) => {
      const value = item[key]
      if (value === undefined) return ''
      if (typeof value !== 'string') throw new TypeError(`registry.msms[${index}].${key} must be a string`)
      return value
    }

    let timeoutMs
    if (item.timeoutMs !== undefined) {
      if (!Number.isInteger(item.timeoutMs) || item.timeoutMs <= 0) {
        throw new TypeError(`registry.msms[${index}].timeoutMs must be a positive integer`)
      }
      timeoutMs = item.timeoutMs
    }

    return Object.freeze({
      name,
      command: command.trim(),
      description: optionalText('description'),
      usage: optionalText('usage'),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    })
  })

  return Object.freeze({ version: 1, entries: Object.freeze(entries) })
}

export async function loadRegistry(workspace, registryFile, options = {}) {
  if (typeof workspace !== 'string' || workspace.trim() === '') {
    throw new TypeError('workspace is required')
  }
  if (typeof registryFile !== 'string' || registryFile.trim() === '' || path.isAbsolute(registryFile)) {
    throw new TypeError('registryFile must be a non-empty relative path')
  }

  const workspaceReal = await realpath(workspace)
  const lexical = path.resolve(workspaceReal, registryFile)
  if (!isInside(workspaceReal, lexical)) {
    throw new Error('registryFile escapes the workspace')
  }

  const fileReal = await realpath(lexical)
  if (!isInside(workspaceReal, fileReal)) {
    throw new Error('registryFile resolves outside the workspace')
  }

  const rawText = await readFile(fileReal, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch (error) {
    throw new SyntaxError(`invalid registry JSON: ${error.message}`)
  }
  return validateRegistry(parsed, options)
}

export function findEntry(registry, name) {
  return registry.entries.find((entry) => entry.name === name)
}

export function suggestEntries(registry, query, limit = 5) {
  const q = String(query ?? '').toLowerCase()
  const ranked = registry.entries
    .map((entry) => {
      const n = entry.name.toLowerCase()
      let score = 3
      if (n === q) score = 0
      else if (n.startsWith(q) || q.startsWith(n)) score = 1
      else if (n.includes(q) || q.includes(n)) score = 2
      return { entry, score }
    })
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
  return ranked.slice(0, Math.max(0, limit)).map(({ entry }) => entry.name)
}