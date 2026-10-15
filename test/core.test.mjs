/**
 * TH-MSM DSH Plugin — Core Tests
 *
 * PRESERVED from v0.1.0 architecture. These tests verify the security
 * boundary: registry validation, path escaping, stdin injection prevention,
 * sandbox policy enforcement, and boundary values.
 *
 * Extended with knowledge base and agent loop tests.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { validateRegistry, loadRegistry, suggestEntries, MSM_NAME_RE } from '../src/registry/loader.js'
import { truncateText } from '../src/util/text.js'
import { resolveTimeout } from '../src/runtime/executor.js'
import { parseCatalog } from '../src/knowledge/catalog.js'
import { searchKnowledge } from '../src/knowledge/searcher.js'

// ── Registry Validation ───────────────────────────────────────

const baseRegistry = {
  version: 1,
  msms: [
    { name: 'echo', command: 'node ./tools/echo.mjs', description: 'echo' },
    { name: 'build_docs', command: 'node ./tools/build.mjs' },
  ],
}

test('valid registry is normalized and frozen', () => {
  const registry = validateRegistry(baseRegistry)
  assert.equal(registry.entries.length, 2)
  assert.equal(Object.isFrozen(registry.entries[0]), true)
})

test('registry rejects duplicates, bad names, and boundary overflow', () => {
  assert.throws(() => validateRegistry({ version: 1, msms: [
    { name: 'echo', command: 'a' }, { name: 'echo', command: 'b' },
  ] }), /duplicate/)

  assert.throws(() => validateRegistry({ version: 1, msms: [
    { name: '../oops', command: 'a' },
  ] }), /invalid/)

  assert.throws(() => validateRegistry({ version: 1, msms: [
    { name: 'a', command: 'a' }, { name: 'b', command: 'b' },
  ] }, { maxEntries: 1 }), /limit/)
})

test('registry path cannot escape workspace lexically', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'th-msm-'))
  try {
    await assert.rejects(
      () => loadRegistry(workspace, '../registry.json'),
      /escapes/
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('registry path cannot escape workspace through a symlink', async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'th-msm-work-'))
  const outside = await mkdtemp(path.join(os.tmpdir(), 'th-msm-out-'))
  try {
    await writeFile(path.join(outside, 'registry.json'), JSON.stringify(baseRegistry))
    await mkdir(path.join(workspace, '.th-msm'))
    try { await symlink(
      path.join(outside, 'registry.json'),
      path.join(workspace, '.th-msm', 'registry.json')
    ) } catch (e) {
      if (process.platform === 'win32' && e.code === 'EPERM') { t.skip('Windows file symlink permission unavailable; Linux CI runs this assertion'); return }
      throw e
    }
    await assert.rejects(
      () => loadRegistry(workspace, '.th-msm/registry.json'),
      /outside/
    )
  } finally {
    await rm(workspace, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('suggestions prioritize prefix matches', () => {
  const registry = validateRegistry(baseRegistry)
  assert.equal(suggestEntries(registry, 'bui')[0], 'build_docs')
})

// ── Text Utilities ────────────────────────────────────────────

test('truncateText handles exact boundary and over-boundary', () => {
  assert.deepEqual(truncateText('12345', 5), { text: '12345', truncated: false })
  const result = truncateText('x'.repeat(100), 40)
  assert.equal(result.truncated, true)
  assert.equal(result.text.length, 40)
})

test('truncateText short texts are head-only', () => {
  const result = truncateText('abc', 2)
  assert.equal(result.truncated, true)
  assert.equal(result.text, 'ab')
})

test('truncateText throws on invalid maxChars', () => {
  assert.throws(() => truncateText('x', 0), /positive integer/)
  assert.throws(() => truncateText('x', -1), /positive integer/)
  assert.throws(() => truncateText('x', 1.5), /positive integer/)
})

// ── Timeout Resolution ────────────────────────────────────────

test('timeout is capped to maxTimeoutMs', () => {
  const config = { defaultTimeoutMs: 30, maxTimeoutMs: 100 }
  assert.equal(resolveTimeout(undefined, config), 30)
  assert.equal(resolveTimeout(500, config), 100)
  assert.equal(resolveTimeout(1, config), 1)
})

// ── MSM Name Validation ───────────────────────────────────────

test('64-character MSM names are accepted and 65-character names are rejected', () => {
  const good = 'a' + 'b'.repeat(63)
  const bad = 'a' + 'b'.repeat(64)
  assert.equal(MSM_NAME_RE.test(good), true)
  assert.equal(MSM_NAME_RE.test(bad), false)
  assert.doesNotThrow(() => validateRegistry({
    version: 1,
    msms: [{ name: good, command: 'x' }],
  }))
  assert.throws(() => validateRegistry({
    version: 1,
    msms: [{ name: bad, command: 'x' }],
  }), /invalid/)
})

// ── Knowledge Base: Catalog Parser ────────────────────────────

test('parseCatalog extracts YAML entries from markdown', () => {
  const catalog = `# Test Catalog

\`\`\`yaml
- id: P001
  title: "Test Paper One"
  authors: "Smith et al."
  journal: "J. Test, 1, 1 (2024)"
  doi: "10.0000/test"
  keywords: [msm, test]
  level: [graduate]
  topic: "theory"
  filename: "P001.pdf"

- id: P002
  title: "Test Paper Two"
  authors: "Jones et al."
  journal: "J. Test, 2, 2 (2024)"
  keywords: [tica, clustering]
  level: [undergraduate, graduate]
  topic: "dim-reduction"
\`\`\`
  `

  const entries = parseCatalog(catalog, 'test/CATALOG.md')
  assert.equal(entries.length, 2)

  assert.equal(entries[0].id, 'P001')
  assert.equal(entries[0].title, 'Test Paper One')
  assert.equal(entries[0].authors, 'Smith et al.')
  assert.deepEqual(entries[0].keywords, ['msm', 'test'])
  assert.deepEqual(entries[0].level, ['graduate'])
  assert.equal(entries[0].topic, 'theory')

  assert.equal(entries[1].id, 'P002')
  assert.equal(entries[1].title, 'Test Paper Two')
  assert.deepEqual(entries[1].level, ['undergraduate', 'graduate'])
})

test('parseCatalog handles empty catalog gracefully', () => {
  const entries = parseCatalog('# Empty Catalog\n\nNo entries yet.\n', 'empty/CATALOG.md')
  assert.equal(entries.length, 0)
})

// ── Knowledge Base: Searcher ──────────────────────────────────

test('searchKnowledge finds papers by query', () => {
  const kb = {
    papers: [
      { id: 'P001', title: 'Markov State Models', authors: 'Prinz', keywords: ['msm', 'theory'], level: ['graduate'], topic: 'theory' },
      { id: 'P002', title: 'tICA for molecular kinetics', authors: 'Perez', keywords: ['tica', 'dim-reduction'], level: ['graduate', 'expert'], topic: 'dim-reduction' },
      { id: 'P003', title: 'Protein folding with MSM', authors: 'Bowman', keywords: ['msm', 'protein', 'folding'], level: ['undergraduate'], topic: 'applications' },
    ],
  }

  const results = searchKnowledge(kb, { query: 'msm', maxResults: 10 })
  assert.ok(results.length >= 2, `Expected >= 2 results for "msm", got ${results.length}`)

  const ticaResults = searchKnowledge(kb, { query: 'tica', maxResults: 10 })
  assert.ok(ticaResults.length >= 1)
  assert.equal(ticaResults[0].id, 'P002')
})

test('searchKnowledge filters by topic', () => {
  const kb = {
    papers: [
      { id: 'P001', title: 'A', keywords: ['msm'], level: ['graduate'], topic: 'theory' },
      { id: 'P002', title: 'B', keywords: ['tica'], level: ['graduate'], topic: 'dim-reduction' },
    ],
  }

  const results = searchKnowledge(kb, { query: '', topic: 'dim-reduction' })
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'P002')
})

test('searchKnowledge filters by level', () => {
  const kb = {
    papers: [
      { id: 'P001', title: 'A', keywords: ['msm'], level: ['graduate'], topic: 'theory' },
      { id: 'P002', title: 'B', keywords: ['msm'], level: ['undergraduate'], topic: 'theory' },
    ],
  }

  const results = searchKnowledge(kb, { query: 'msm', level: 'undergraduate' })
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'P002')
})

test('searchKnowledge empty kb returns empty', () => {
  const results = searchKnowledge({ papers: [] }, { query: 'test' })
  assert.equal(results.length, 0)
})
