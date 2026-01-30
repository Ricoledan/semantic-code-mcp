/**
 * Mock embedder for testing without loading ML models.
 */

import type { EmbeddingResult } from '../../src/embedder/index.js';

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
 * Mock embedQuery function
 */
export function mockEmbedQuery(query: string): EmbeddingResult {
  return mockEmbed(`search_query: ${query}`);
}

/**
 * Mock embedBatch function
 */
export function mockEmbedBatch(texts: string[]): EmbeddingResult[] {
  return texts.map((text) => mockEmbed(`search_document: ${text}`));
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
 * Create a failing embedder for error testing
 */
export function createFailingEmbedder(errorMessage = 'Mock embedding error') {
  return {
    embed: jest.fn().mockRejectedValue(new Error(errorMessage)),
    embedQuery: jest.fn().mockRejectedValue(new Error(errorMessage)),
    embedBatch: jest.fn().mockRejectedValue(new Error(errorMessage)),
  };
}
