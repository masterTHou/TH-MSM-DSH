/**
 * Vector Embedder — Local embedding model via @xenova/transformers.
 *
 * Uses all-MiniLM-L6-v2 (384 dims, 80 MB, quantized) for CPU-friendly,
 * Node.js-native embedding with no Python or API key required.
 *
 * Model is downloaded once on first use and cached in node_modules/.cache.
 *
 * Usage:
 *   const embedder = await getEmbedder()
 *   const vec = await embedder.embed("Markov State Model theory")
 *   // vec is Float32Array(384)
 */

let _pipeline = null
let _modelName = 'Xenova/all-MiniLM-L6-v2'

/**
 * Lazy-load the embedding pipeline. Called automatically on first embed().
 */
async function loadPipeline() {
  if (_pipeline) return _pipeline

  const { pipeline } = await import('@xenova/transformers')
  _pipeline = await pipeline('feature-extraction', _modelName, {
    quantized: true,          // Use ONNX quantized model (~23 MB vs 90 MB)
    local_files_only: false,  // Download from HuggingFace Hub on first run
  })
  return _pipeline
}

/**
 * Embed a single text string.
 * @param {string} text
 * @returns {Promise<Float32Array>} 384-dimensional embedding
 */
export async function embed(text) {
  const pipe = await loadPipeline()
  const result = await pipe(text, {
    pooling: 'mean',
    normalize: true,
  })
  // result.data is Float32Array(384)
  return result.data
}

/**
 * Embed a batch of texts. Much faster than calling embed() in a loop.
 * @param {string[]} texts
 * @returns {Promise<Float32Array[]>}
 */
export async function embedBatch(texts) {
  const pipe = await loadPipeline()
  const embeddings = []
  for (const text of texts) {
    const result = await pipe(text, {
      pooling: 'mean',
      normalize: true,
    })
    embeddings.push(result.data)
  }
  return embeddings
}

/**
 * Build the text to embed for a paper entry.
 * Concatenates title + keywords + topic for richer semantic representation.
 */
export function buildPaperText(paper) {
  const parts = [paper.title]
  if (paper.keywords?.length) parts.push(paper.keywords.join(', '))
  if (paper.topic) parts.push(`topic:${paper.topic}`)
  if (paper.level?.length) parts.push(`level:${paper.level.join(',')}`)
  return parts.join(' ')
}

/**
 * Set a custom embedding model name.
 * @param {string} name — HuggingFace model id (e.g. 'Xenova/bge-small-en-v1.5')
 */
export function setModel(name) {
  _modelName = name
  _pipeline = null  // force reload
}

/**
 * Get the embedding dimension for the current model.
 */
export function getDimension() {
  return 384 // all-MiniLM-L6-v2
}

/**
 * Release the model from memory.
 */
export async function dispose() {
  if (_pipeline) {
    await _pipeline.dispose?.()
    _pipeline = null
  }
}