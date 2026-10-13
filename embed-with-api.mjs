#!/usr/bin/env node
/**
 * 调用 DeepSeek Embedding API 向量化所有论�?chunk�? *
 * 用法:
 *   set DEEPSEEK_API_KEY=sk-xxx
 *   node embed-with-api.mjs
 */

import { readFileSync, writeFileSync } from 'fs'

const API_KEY = process.env.DEEPSEEK_API_KEY || ''
if (!API_KEY) throw new Error('请设置环境变�?DEEPSEEK_API_KEY')

const db = JSON.parse(readFileSync('prebuilt/vector-db.json', 'utf8'))
const chunks = db.chunks

console.log(`Embedding ${chunks.length} chunks via DeepSeek API...`)

// Batch size: 32
const BATCH = 32
const vectors = []

for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH)
  const texts = batch.map(c => c.text)

  const res = await fetch('https://api.deepseek.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-embedding',
      input: texts,
      encoding_format: 'float',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  for (const item of data.data) {
    vectors.push(item.embedding)
  }
  console.log(`  batch ${i / BATCH + 1}/${Math.ceil(chunks.length / BATCH)}: ${batch.length} chunks done`)
}

// Attach vectors to chunks
for (let i = 0; i < chunks.length; i++) {
  chunks[i].vector = vectors[i]
}

db.vectorsBuilt = true
db.builtAt = new Date().toISOString()
writeFileSync('prebuilt/vector-db.json', JSON.stringify(db, null, 2))

console.log(`\nDone! ${chunks.length} vectors written to prebuilt/vector-db.json`)