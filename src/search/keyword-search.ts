/**
 * Keyword-only search fallback for when embedding generation fails.
 *
 * This module provides a fallback search mechanism that uses full-text search
 * instead of vector similarity. It's automatically triggered when:
 * - The embedding model fails to load
 * - Embedding generation encounters an error
 * - The embedder is unavailable
 *
 * @module search/keyword-search
 */

import type { VectorStore, SearchResult } from '../store/index.js';
import { buildSafeFilter } from './filter-builder.js';
import type { SearchOptions } from './index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('keyword-search');

/**
 * Result from keyword-only search.
 */
export interface KeywordSearchResult extends SearchResult {
  /** Indicates this result came from keyword fallback */
  fromFallback: true;
}

/**
 * Perform keyword-only search using the store's full-text search capability.
 *
 * This function provides a degraded but functional search experience when
 * vector search is unavailable. It uses the store's fullTextSearch method
 * which falls back to manual keyword matching if FTS is not available.
 *
 * @param query - The search query
 * @param store - The vector store instance
 * @param options - Search options (limit, filePattern, path)
 * @returns Search results from keyword matching
 *
 * @example
 * ```typescript
 * // Fallback search when embedder fails
 * try {
 *   return await hybridSearch(query, store, options);
 * } catch (error) {
 *   if (error instanceof EmbeddingGenerationError) {
 *     return await keywordOnlySearch(query, store, options);
 *   }
 *   throw error;
 * }
 * ```
 */
export async function keywordOnlySearch(
  query: string,
  store: VectorStore,
  options: SearchOptions = {}
): Promise<KeywordSearchResult[]> {
  const { limit = 10, onProgress } = options;

  log.info('Executing keyword-only search', { query, limit });
  onProgress?.('Using keyword-only search (embedding unavailable)...');

  // Check if store is empty
  const isEmpty = await store.isEmpty();
  if (isEmpty) {
    log.warn('Store is empty');
    onProgress?.('Index is empty. Run indexing first.');
    return [];
  }

  // Build filter from options
  const filter = buildSafeFilter(options);

  // Use the store's full-text search
  onProgress?.('Searching by keywords...');
  let results = await store.fullTextSearch(query, limit * 2); // Get extra for filtering

  // Apply filter if present (since FTS may not support filters directly)
  if (filter) {
    results = applyFilter(results, filter);
  }

  // Limit results
  results = results.slice(0, limit);

  log.info('Keyword search complete', { resultCount: results.length });
  onProgress?.(`Found ${results.length} results via keyword search`);

  // Mark results as coming from fallback
  return results.map((result) => ({
    ...result,
    fromFallback: true as const,
  }));
}

/**
 * Apply a simple filter to search results.
 *
 * This is a basic filter implementation for cases where the underlying
 * search doesn't support filtering directly.
 *
 * @internal
 */
function applyFilter(results: SearchResult[], filter: string): SearchResult[] {
  // Parse simple filter expressions
  const languageMatch = filter.match(/language\s*=\s*'([^']+)'/);
  const idLikeMatch = filter.match(/id\s+LIKE\s+'([^']+)'/);

  return results.filter((result) => {
    // Check language filter
    if (languageMatch?.[1]) {
      if (result.record.language !== languageMatch[1]) {
        return false;
      }
    }

    // Check ID pattern filter
    if (idLikeMatch?.[1]) {
      const pattern = idLikeMatch[1].replace(/%/g, '.*').replace(/_/g, '.');
      const regex = new RegExp(`^${pattern}`);
      if (!regex.test(result.record.id)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Check if an error indicates the embedder is unavailable.
 *
 * @param error - The error to check
 * @returns true if this error indicates embedding failure
 */
export function isEmbeddingError(error: unknown): boolean {
  if (error instanceof Error) {
    const name = error.name;
    return (
      name === 'EmbeddingGenerationError' ||
      name === 'ModelLoadError' ||
      name === 'EmbedderError'
    );
  }
  return false;
}
