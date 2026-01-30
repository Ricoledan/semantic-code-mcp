/**
 * Mock embedder for testing without loading ML models.
 *
 * Provides both basic deterministic embeddings and semantic-aware embeddings
 * that produce similar vectors for related content.
 */

import type { EmbeddingResult, BatchEmbeddingResult } from '../../src/embedder/index.js';

/**
 * Semantic categories for keyword-based similarity.
 * Related content in the same category will have more similar embeddings.
 */
const SEMANTIC_CATEGORIES: Record<string, string[]> = {
  auth: ['auth', 'login', 'logout', 'password', 'token', 'jwt', 'session', 'credential', 'identity', 'oauth'],
  data: ['data', 'database', 'query', 'sql', 'model', 'schema', 'orm', 'entity', 'record', 'crud'],
  http: ['http', 'request', 'response', 'api', 'rest', 'endpoint', 'route', 'fetch', 'axios', 'url'],
  error: ['error', 'exception', 'throw', 'catch', 'try', 'handle', 'fail', 'invalid', 'unexpected'],
  test: ['test', 'spec', 'mock', 'stub', 'assert', 'expect', 'jest', 'vitest', 'describe', 'it'],
  config: ['config', 'setting', 'option', 'env', 'environment', 'parameter', 'constant'],
  file: ['file', 'read', 'write', 'path', 'directory', 'fs', 'stream', 'buffer'],
  async: ['async', 'await', 'promise', 'callback', 'then', 'concurrent', 'parallel'],
  ui: ['component', 'render', 'view', 'dom', 'element', 'style', 'css', 'html', 'jsx', 'tsx'],
  util: ['util', 'helper', 'format', 'parse', 'convert', 'transform', 'validate'],
};

/**
 * Get semantic category scores for text.
 * Returns a map of category name to match score.
 */
function getCategoryScores(text: string): Map<string, number> {
  const lowerText = text.toLowerCase();
  const scores = new Map<string, number>();

  for (const [category, keywords] of Object.entries(SEMANTIC_CATEGORIES)) {
    let score = 0;
    for (const keyword of keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    if (score > 0) {
      scores.set(category, score);
    }
  }

  return scores;
}

/**
 * Generate a deterministic mock embedding based on text content.
 * Produces consistent 768-dimensional vectors.
 */
export function mockEmbed(text: string): EmbeddingResult {
  // Generate a simple hash-based embedding for consistency
  const embedding = new Array(768).fill(0);

  // Create a simple deterministic pattern from the text
  for (let i = 0; i < text.length && i < 768; i++) {
    const charCode = text.charCodeAt(i);
    embedding[i % 768] += charCode / 1000;
  }

  // Normalize the embedding
  let magnitude = 0;
  for (const val of embedding) {
    magnitude += val * val;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i]! / magnitude;
    }
  }

  return {
    embedding,
    tokenCount: Math.ceil(text.length / 4),
  };
}

/**
 * Generate a semantic-aware mock embedding.
 *
 * This function produces embeddings where:
 * - Texts with similar semantic categories have higher cosine similarity
 * - Different categories produce orthogonal vectors
 *
 * This enables meaningful integration testing without real ML models.
 *
 * @param text - The text to embed
 * @returns Embedding result with semantic awareness
 *
 * @example
 * ```typescript
 * const authEmbed1 = mockEmbedSemantic('function login(user, password) {}');
 * const authEmbed2 = mockEmbedSemantic('function authenticate(credentials) {}');
 * const dataEmbed = mockEmbedSemantic('function queryDatabase(sql) {}');
 *
 * // authEmbed1 and authEmbed2 will have high similarity
 * // authEmbed1 and dataEmbed will have lower similarity
 * ```
 */
export function mockEmbedSemantic(text: string): EmbeddingResult {
  const embedding = new Array(768).fill(0);

  // Get category scores
  const categoryScores = getCategoryScores(text);

  // Each category gets a dedicated range of dimensions (76 dims each for 10 categories)
  const dimsPerCategory = 76;
  const categories = Object.keys(SEMANTIC_CATEGORIES);

  for (const [category, score] of categoryScores) {
    const categoryIndex = categories.indexOf(category);
    if (categoryIndex >= 0) {
      const startDim = categoryIndex * dimsPerCategory;
      // Spread the category signal across its dimensions
      for (let i = 0; i < dimsPerCategory; i++) {
        // Use a sinusoidal pattern for more realistic distribution
        embedding[startDim + i] = score * Math.sin((i / dimsPerCategory) * Math.PI);
      }
    }
  }

  // Add some text-specific variation in the remaining dimensions (760-767)
  for (let i = 760; i < 768; i++) {
    let sum = 0;
    for (let j = 0; j < text.length; j++) {
      sum += text.charCodeAt(j) * Math.sin(j * (i - 759));
    }
    embedding[i] = sum / (text.length + 1);
  }

  // Normalize the embedding
  let magnitude = 0;
  for (const val of embedding) {
    magnitude += val * val;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i]! / magnitude;
    }
  } else {
    // If no categories matched, fall back to hash-based embedding
    return mockEmbed(text);
  }

  return {
    embedding,
    tokenCount: Math.ceil(text.length / 4),
  };
}

/**
 * Mock embedQuery function
 */
export function mockEmbedQuery(query: string): EmbeddingResult {
  return mockEmbed(`search_query: ${query}`);
}

/**
 * Semantic-aware mock embedQuery function
 */
export function mockEmbedQuerySemantic(query: string): EmbeddingResult {
  return mockEmbedSemantic(`search_query: ${query}`);
}

/**
 * Mock embedBatch function
 */
export function mockEmbedBatch(texts: string[]): EmbeddingResult[] {
  return texts.map((text) => mockEmbed(`search_document: ${text}`));
}

/**
 * Semantic-aware mock embedBatch function
 */
export function mockEmbedBatchSemantic(texts: string[]): EmbeddingResult[] {
  return texts.map((text) => mockEmbedSemantic(`search_document: ${text}`));
}

/**
 * Mock embedBatchWithErrors function for testing error handling
 */
export function mockEmbedBatchWithErrors(
  texts: string[],
  failIndices: number[] = []
): BatchEmbeddingResult {
  const results: EmbeddingResult[] = [];
  const failedIndices: number[] = [];
  const errors = new Map<number, string>();

  for (let i = 0; i < texts.length; i++) {
    if (failIndices.includes(i)) {
      failedIndices.push(i);
      errors.set(i, `Mock error for item ${i}`);
      results.push({
        embedding: new Array(768).fill(0),
        tokenCount: 0,
      });
    } else {
      results.push(mockEmbed(texts[i]!));
    }
  }

  return {
    results,
    failedIndices,
    errors,
    totalProcessed: texts.length,
    successCount: texts.length - failedIndices.length,
  };
}

/**
 * Create a mock embedder that can be injected
 */
export function createMockEmbedder() {
  return {
    embed: jest.fn().mockImplementation((text: string) => Promise.resolve(mockEmbed(text))),
    embedQuery: jest.fn().mockImplementation((query: string) => Promise.resolve(mockEmbedQuery(query))),
    embedBatch: jest.fn().mockImplementation((texts: string[]) => Promise.resolve(mockEmbedBatch(texts))),
  };
}

/**
 * Create a semantic-aware mock embedder
 */
export function createSemanticMockEmbedder() {
  return {
    embed: jest.fn().mockImplementation((text: string) => Promise.resolve(mockEmbedSemantic(text))),
    embedQuery: jest.fn().mockImplementation((query: string) => Promise.resolve(mockEmbedQuerySemantic(query))),
    embedBatch: jest.fn().mockImplementation((texts: string[]) => Promise.resolve(mockEmbedBatchSemantic(texts))),
  };
}

/**
 * Create a failing embedder for error testing
 */
export function createFailingEmbedder(errorMessage = 'Mock embedding error') {
  const error = new Error(errorMessage);
  error.name = 'EmbeddingGenerationError';

  return {
    embed: jest.fn().mockRejectedValue(error),
    embedQuery: jest.fn().mockRejectedValue(error),
    embedBatch: jest.fn().mockRejectedValue(error),
  };
}

/**
 * Create an embedder that fails on specific indices
 */
export function createPartiallyFailingEmbedder(failIndices: number[]) {
  let callCount = 0;

  return {
    embed: jest.fn().mockImplementation((text: string) => {
      const index = callCount++;
      if (failIndices.includes(index)) {
        const error = new Error(`Mock error for item ${index}`);
        error.name = 'EmbeddingGenerationError';
        return Promise.reject(error);
      }
      return Promise.resolve(mockEmbed(text));
    }),
    embedQuery: jest.fn().mockImplementation((query: string) =>
      Promise.resolve(mockEmbedQuery(query))
    ),
    embedBatch: jest.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(mockEmbedBatchWithErrors(texts, failIndices).results)
    ),
  };
}

/**
 * Calculate cosine similarity between two embeddings.
 * Useful for asserting semantic similarity in tests.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
