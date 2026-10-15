/**
 * Knowledge Base Loader — Scan the knowledge directory and load CATALOG.md files.
 *
 * The knowledge base is file-system-based. No database needed.
 * CATALOG.md files contain YAML entries; this module parses them
 * and builds an in-memory index for fast search.
 *
 * Directory structure:
 *   knowledge/
 *     reviews/CATALOG.md
 *     papers/CATALOG.md
 *     benchmarks/CATALOG.md
 */

import { readFile, readdir, access } from 'node:fs/promises'
import path from 'node:path'
import { parseCatalog } from './catalog.js'

/**
 * Load the complete knowledge base from the workspace.
 *
 * @param {string} workspace — Workspace root path
 * @param {string} basePath — Relative path to knowledge directory (e.g., "knowledge")
 * @param {string[]} catalogs — Relative catalog paths (e.g., ["reviews/CATALOG.md"])
 * @returns {object} { papers, benchmarks, catalogs, loadedAt }
 */
export async function loadKnowledgeBase(workspace, basePath, catalogs) {
  const kbPath = path.join(workspace, basePath)

  // Verify knowledge directory exists
  try {
    await access(kbPath)
  } catch {
    // Knowledge base is optional — return empty
    return {
      papers: [],
      benchmarks: [],
      catalogs: [],
      loadedAt: new Date().toISOString(),
      empty: true,
      message: `Knowledge base not found at ${kbPath}. Add papers to enable knowledge search.`,
    }
  }

  const allPapers = []
  const allBenchmarks = []

  for (const catalogFile of catalogs) {
    const catalogPath = path.join(kbPath, catalogFile)
    try {
      await access(catalogPath)
      const content = await readFile(catalogPath, 'utf8')
      const entries = parseCatalog(content, catalogFile)

      if (catalogFile.includes('benchmarks')) {
        allBenchmarks.push(...entries)
      } else {
        allPapers.push(...entries)
      }
    } catch {
      // Catalog doesn't exist yet — skip
    }
  }

  return {
    papers: allPapers,
    benchmarks: allBenchmarks,
    catalogs,
    loadedAt: new Date().toISOString(),
  }
}

/**
 * Load the MSM learning roadmap.
 */
export async function loadRoadmap(workspace, roadmapFile) {
  const roadmapPath = path.join(workspace, roadmapFile)
  try {
    await access(roadmapPath)
    return await readFile(roadmapPath, 'utf8')
  } catch {
    return null
  }
}

/**
 * Reload the knowledge base (for use when new papers are added).
 */
export async function reloadKnowledgeBase(workspace, basePath, catalogs) {
  return loadKnowledgeBase(workspace, basePath, catalogs)
}
