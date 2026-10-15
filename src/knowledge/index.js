#!/usr/bin/env node

/**
 * TH-MSM Knowledge Base CLI
 *
 * Commands:
 *   node src/knowledge/index.js build     — Build the vector index from CATALOG.md files
 *   node src/knowledge/index.js status    — Check vector index status
 *   node src/knowledge/index.js rebuild   — Force rebuild the vector index
 *   node src/knowledge/index.js search "query" — Search the knowledge base
 */

import { buildIndex, checkIndex } from './vector/indexer.js'
import { getRetriever } from './vector/retriever.js'

const command = process.argv[2] ?? 'status'
const workspace = process.argv[3] ?? process.cwd()

const BASE_PATH = 'knowledge'
const CATALOGS = [
  'reviews/CATALOG.md',
  'papers/CATALOG.md',
  'benchmarks/CATALOG.md',
]

async function main() {
  switch (command) {
    case 'build':
    case 'rebuild': {
      console.log(`Building vector index (force=${command === 'rebuild'})...`)
      const result = await buildIndex(workspace, BASE_PATH, CATALOGS, {
        force: command === 'rebuild',
        onProgress: (current, total) => {
          process.stdout.write(`\r  Embedding... ${current}/${total} papers`)
        },
      })
      console.log(`\n${result.message}`)
      break
    }

    case 'status': {
      const status = await checkIndex(workspace)
      console.log(`Vector index: ${status.exists ? `ready (${status.count} papers)` : 'not built'}`)
      break
    }

    case 'search': {
      const query = process.argv[4] ?? ''
      if (!query) {
        console.log('Usage: node src/knowledge/index.js search "your query"')
        break
      }
      const retriever = await getRetriever(workspace)
      const results = await retriever.retrieve(query, { topK: 10 })
      console.log(`\nResults for "${query}" (${results.length}):\n`)
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        console.log(`${i + 1}. [${(r.score ?? 0).toFixed(3)}] ${r.title}`)
        console.log(`   ${r.metadata?.authors ?? ''} — ${r.metadata?.journal ?? ''}`)
        console.log(`   source: ${r.source} | topic: ${r.metadata?.topic ?? 'N/A'}`)
        console.log()
      }
      await retriever.dispose()
      break
    }

    default:
      console.log('Unknown command. Use: build, rebuild, status, search')
  }
}

main().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
