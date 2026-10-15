/**
 * Vector Indexer — Build the vector index from CATALOG.md files.
 *
 * Reads all paper entries from the knowledge base catalogs,
 * embeds them using the local embedding model, and stores
 * the vectors in the vector database.
 *
 * Usage:
 *   await buildIndex(workspace)
 *
 * This is typically called:
 * 1. On first plugin load (if vector DB is empty)
 * 2. After adding new papers to CATALOG.md
 * 3. Via the knowledge CLI: node src/knowledge/index.js --build
 */

import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { parseCatalog } from '../catalog.js'
import { embedBatch, buildPaperText, dispose } from './embedder.js'
import { openStore } from './store.js'

/**
 * Build the vector index from all CATALOG.md files in the knowledge base.
 *
 * @param {string} workspace — Workspace root
 * @param {string} basePath — Path to knowledge/ directory
 * @param {string[]} catalogs — Array of catalog file paths
 * @param {object} opts
 * @param {boolean} opts.force — Force rebuild even if index exists
 * @param {function} opts.onProgress — Progress callback (current, total)
 * @returns {object} { indexed, skipped, errors }
 */
export async function buildIndex(workspace, basePath = 'knowledge', catalogs = [], opts = {}) {
  const { force = false, onProgress } = opts

  const table = await openStore(workspace)
  const existingCount = await table.count()

  if (existingCount > 0 && !force) {
    return { indexed: 0, skipped: existingCount, errors: 0, message: `Index already exists with ${existingCount} entries. Use force=true to rebuild.` }
  }

  // Collect a complete replacement before modifying any existing index.
  const pendingRows = []

  // Collect all papers from all catalogs
  const allPapers = []
  for (const catalogFile of catalogs) {
    const catalogPath = path.join(workspace, basePath, catalogFile)
    try {
      const content = await readFile(catalogPath, 'utf8')
      const entries = parseCatalog(content, catalogFile)
      const source = catalogFile.includes('reviews') ? 'reviews'
        : catalogFile.includes('benchmarks') ? 'benchmarks'
        : 'papers'

      for (const entry of entries) {
        allPapers.push({ ...entry, source })
      }
    } catch (error) {
      // Catalog doesn't exist or is malformed — skip
    }
  }

  if (allPapers.length === 0) {
    return { indexed: 0, skipped: 0, errors: 0, message: 'No papers found in catalogs.' }
  }

  // Build text chunks for embedding
  const texts = allPapers.map(p => buildPaperText(p))

  // Embed in batches of 32 (balance speed vs memory for all-MiniLM)
  const BATCH_SIZE = 32
  const totalBatches = Math.ceil(texts.length / BATCH_SIZE)
  let errors = 0

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchPapers = allPapers.slice(i, i + BATCH_SIZE)

    try {
      const vectors = await embedBatch(batch)

      const rows = batchPapers.map((paper, j) => ({
        id: paper.id,
        source: paper.source,
        text: batch[j],
        vector: vectors[j],
        metadata: JSON.stringify({
          id: paper.id,
          title: paper.title,
          authors: paper.authors,
          journal: paper.journal,
          year: paper.year,
          keywords: paper.keywords,
          level: paper.level,
          topic: paper.topic,
          doi: paper.doi,
          filename: paper.filename,
          source: paper.source,
        }),
      }))

      pendingRows.push(...rows)
    } catch (error) {
      errors += batch.length
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, texts.length), texts.length)
    }
  }

  // Release the model from memory
  await dispose()

  if (errors === 0 && pendingRows.length) {
    if (force) await table.replace(pendingRows)
    else await table.upsert(pendingRows)
  }

  const count = await table.count()
  return {
    indexed: count,
    skipped: 0,
    errors,
    message: `Index built: ${count} papers indexed${errors ? `, ${errors} errors` : ''}.`,
  }
}

/**
 * Check if the vector index exists and is up-to-date.
 */
export async function checkIndex(workspace) {
  try {
    const table = await openStore(workspace)
    const count = await table.count()
    return { exists: count > 0, count }
  } catch {
    return { exists: false, count: 0 }
  }
}
