/**
 * text_to_vector.js
 *
 * Converts any given text into a vector embedding using a Sentence
 * Transformers model, run locally in Node.js via the @xenova/transformers
 * library (a JS port of HuggingFace transformers — no Python required).
 *
 * Install:
 *   npm install @xenova/transformers
 *
 * Run:
 *   node text_to_vector.js "Your sentence here"
 */

import { pipeline } from '@xenova/transformers';
import { pathToFileURL } from 'url';

// Cache the pipeline so the model is only loaded once,
// even if embedText() is called multiple times.
let embedder = null;

/**
 * Loads (once) and returns the feature-extraction pipeline.
 * Default model: 'Xenova/all-MiniLM-L6-v2' — a popular, lightweight
 * Sentence-Transformers model (384-dimensional embeddings).
 */
async function getEmbedder(modelName = 'Xenova/all-MiniLM-L6-v2') {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', modelName);
  }
  return embedder;
}

/**
 * Converts a text string (or array of strings) into embedding vector(s).
 *
 * @param {string|string[]} text - The input text(s) to embed.
 * @param {object} [options]
 * @param {string} [options.model] - HuggingFace model name to use.
 * @param {boolean} [options.normalize=true] - L2-normalize the output vector.
 * @returns {Promise<number[]|number[][]>} - A single vector, or an array of
 *   vectors if multiple texts were passed in.
 */
async function embedText(text, options = {}) {
  const { model = 'Xenova/all-MiniLM-L6-v2', normalize = true } = options;
  const extractor = await getEmbedder(model);

  const output = await extractor(text, {
    pooling: 'mean',   // mean-pool token embeddings into one sentence vector
    normalize,          // L2-normalize so cosine similarity = dot product
  });

  // output.data is a flat Float32Array; output.dims tells us the shape.
  const [batchSize, dim] = output.dims.length === 2 ? output.dims : [1, output.dims[0]];
  const vectors = [];
  for (let i = 0; i < batchSize; i++) {
    vectors.push(Array.from(output.data.slice(i * dim, (i + 1) * dim)));
  }

  return Array.isArray(text) ? vectors : vectors[0];
}

/**
 * Computes cosine similarity between two equal-length vectors.
 */
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---- CLI usage example ----
// node text_to_vector.js "The cat sits on the mat"
async function main() {
  const input = process.argv.slice(2).join(' ') || 'Hello, world!';

  console.log(`Embedding text: "${input}"`);
  const vector = await embedText(input);

  console.log(`Vector dimension: ${vector.length}`);
  console.log(`Full vector:\n[${vector.map(v => v.toFixed(6)).join(', ')}]`);
}

// Only run CLI demo if this file is executed directly (not imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(console.error);
}

export { embedText, cosineSimilarity, getEmbedder };