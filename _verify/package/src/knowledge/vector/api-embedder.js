/**
 * API Embedder — DeepSeek API 向量化（主力方案）
 *
 * 使用 DeepSeek Embedding API 对论文文本做向量化。
 * 模型：deepseek-embedding（1536 维或根据实际 API 返回调整）。
 *
 * 优势：
 *  - 无需下载 80MB 本地模型
 *  - API 调用快（批量 35 篇 ~5 秒）
 *  - 预构建后打包进 tgz，用户即装即用
 *
 * Fallback：如果 API 不可用，降级到 @xenova/transformers 本地模型。
 */

const API_BASE = 'https://api.deepseek.com'
const EMBEDDING_MODEL = 'deepseek-embedding'

/**
 * 调用 DeepSeek Embedding API。
 * @param {string[]} texts — 待向量化的文本数组
 * @param {string} apiKey — DeepSeek API Key
 * @returns {Promise<number[][]>} 向量数组
 */
async function callDeepSeekEmbedding(texts, apiKey) {
  const url = `${API_BASE}/v1/embeddings`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`DeepSeek Embedding API error (${response.status}): ${error}`)
  }

  const data = await response.json()
  // data.data[].embedding: number[]
  return data.data.map(item => item.embedding)
}

/**
 * 批量向量化（自动分批，每批最多 32 篇）。
 * @param {string[]} texts
 * @param {string} apiKey
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatchWithAPI(texts, apiKey) {
  const BATCH_SIZE = 32
  const allVectors = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const vectors = await callDeepSeekEmbedding(batch, apiKey)
    for (const vec of vectors) {
      allVectors.push(new Float32Array(vec))
    }
  }

  return allVectors
}

/**
 * 单条向量化。
 */
export async function embedWithAPI(text, apiKey) {
  const results = await embedBatchWithAPI([text], apiKey)
  return results[0]
}

/**
 * 获取 API embedding 的维度。
 */
export function getAPIDimension() {
  return 1536 // deepseek-embedding 默认维度
}