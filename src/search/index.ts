/**
 * Hybrid search orchestration combining vector similarity, keyword matching, and reranking.
 *
 * This module provides the main search functionality, combining:
 * - Vector similarity search using embeddings
 * - Keyword boosting for exact matches
 * - Cross-encoder reranking for precision
 * - Automatic fallback to keyword-only search when embeddings fail
 *
 * @module search
 */

import type { VectorStore, SearchResult } from '../store/index.js';
import { embedQuery } from '../embedder/index.js';
import { rerank, boostKeywordMatches } from './reranker.js';
import { buildSafeFilter } from './filter-builder.js';
import { EmbeddingGenerationError } from '../errors.js';
import { keywordOnlySearch, isEmbeddingError } from './keyword-search.js';
import { createLogger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

const log = createLogger('search');

/**
 * Options for configuring search behavior.
 */
export interface SearchOptions {
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Optional file path filter (glob pattern, e.g., "*.ts", "src/*.py") */
  filePattern?: string;
  /** Optional directory scope to limit search */
  path?: string;
  /** Whether to use cross-encoder reranking (default: true) */
  useReranking?: boolean;
  /** Number of candidates for vector search before reranking (default: 5) */
  candidateMultiplier?: number;
  /** Progress callback for status updates */
  onProgress?: (message: string) => void;
  /** Whether to fall back to keyword search if embeddings fail (default: true) */
  fallbackToKeywordSearch?: boolean;
}

/**
 * Extended search result with combined scoring information.
 */
export interface HybridSearchResult extends SearchResult {
  /** Combined score from multiple signals (0-1) */
  combinedScore: number;
  /** Vector similarity score (0-1) */
  vectorScore: number;
  /** Keyword match boost score */
  keywordScore: number;
  /** Whether this result came from keyword fallback */
  fromFallback?: boolean;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_CANDIDATE_MULTIPLIER = 5;

/**
 * Perform hybrid search combining vector similarity and keyword matching.
 *
 * This function orchestrates the full search pipeline:
 * 1. Generate query embedding
 * 2. Vector similarity search
 * 3. Keyword boosting
 * 4. Cross-encoder reranking (optional)
 *
 * If embedding generation fails and `fallbackToKeywordSearch` is true (default),
 * automatically falls back to keyword-only search.
 *
 * @param query - Natural language search query
 * @param store - The vector store to search
 * @param options - Search configuration options
 * @returns Array of search results with combined scores
 *
 * @throws {EmbeddingGenerationError} When embedding fails and fallback is disabled
 *
 * @example
 * ```typescript
 * const results = await hybridSearch('authentication middleware', store, {
 *   limit: 10,
 *   filePattern: '*.ts',
 *   useReranking: true,
 * });
 * ```
 */
export async function hybridSearch(
  query: string,
  store: VectorStore,
  options: SearchOptions = {}
): Promise<HybridSearchResult[]> {
  const {
    limit = DEFAULT_LIMIT,
    useReranking = true,
    candidateMultiplier = DEFAULT_CANDIDATE_MULTIPLIER,
    fallbackToKeywordSearch = true,
    onProgress,
  } = options;

  const startTime = Date.now();
  log.info('Starting hybrid search', { query, limit, useReranking });

  // Check if store is empty
  const isEmpty = await store.isEmpty();
  if (isEmpty) {
    log.warn('Store is empty');
    onProgress?.('Index is empty. Run indexing first.');
    return [];
  }

  // Step 1: Generate query embedding
  onProgress?.('Generating query embedding...');
  let queryVector: number[];
  try {
    const result = await embedQuery(query, { onProgress });
    queryVector = result.embedding;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Embedding generation failed', { error: message });

    // Fall back to keyword search if enabled
    if (fallbackToKeywordSearch && isEmbeddingError(error)) {
      log.info('Falling back to keyword-only search');
      onProgress?.('Embedding failed, falling back to keyword search...');

      const keywordResults = await keywordOnlySearch(query, store, options);
      const latency = Date.now() - startTime;
      metrics.recordSearch(latency, keywordResults.length, true);

      // Convert to HybridSearchResult format
      return keywordResults.map((result) => ({
        ...result,
        combinedScore: result.score,
        vectorScore: 0,
        keywordScore: result.score,
        fromFallback: true,
      }));
    }

    throw new EmbeddingGenerationError(
      `Failed to generate query embedding: ${message}`,
      error instanceof Error ? error : undefined
    );
  }

  // Step 2: Vector similarity search (get more candidates for reranking)
  const candidateCount = useReranking ? limit * candidateMultiplier : limit;
  const filter = buildSafeFilter(options);

  onProgress?.(`Searching for ${candidateCount} candidates...`);
  const vectorResults = await store.vectorSearch(queryVector, candidateCount, filter);

  if (vectorResults.length === 0) {
    log.info('No vector results found');
    onProgress?.('No matching results found');
    const latency = Date.now() - startTime;
    metrics.recordSearch(latency, 0, false);
    return [];
  }

  // Step 3: Apply keyword boosting
  onProgress?.('Applying keyword matching...');
  const boostedResults = boostKeywordMatches(query, vectorResults);

  // Step 4: Optional cross-encoder reranking
  let finalResults: SearchResult[];
  if (useReranking && boostedResults.length > limit) {
    onProgress?.('Reranking results...');
    try {
      finalResults = await rerank(query, boostedResults, limit, { onProgress });
    } catch (error) {
      log.warn('Reranking failed, using boosted results', {
        error: error instanceof Error ? error.message : String(error)
      });
      onProgress?.(`Reranking failed: ${error}`);
      // Fall back to boosted results without reranking
      finalResults = boostedResults.slice(0, limit);
    }
  } else {
    finalResults = boostedResults.slice(0, limit);
  }

  // Record metrics
  const latency = Date.now() - startTime;
  metrics.recordSearch(latency, finalResults.length, false);
  log.info('Search complete', { resultCount: finalResults.length, latencyMs: latency });

  // Convert to HybridSearchResult
  return finalResults.map((result) => {
    const originalVector = vectorResults.find((r) => r.record.id === result.record.id);
    const boosted = boostedResults.find((r) => r.record.id === result.record.id);

    return {
      ...result,
      combinedScore: result.score,
      vectorScore: originalVector?.score ?? 0,
      keywordScore: boosted ? boosted.score - (originalVector?.score ?? 0) : 0,
    };
  });
}

/**
 * Simple vector-only search (faster, for when speed is priority).
 *
 * This performs only vector similarity search without keyword boosting
 * or reranking. Useful for quick searches where latency is critical.
 *
 * @param query - Natural language search query
 * @param store - The vector store to search
 * @param options - Search configuration options
 * @returns Array of search results
 *
 * @throws {EmbeddingGenerationError} When embedding generation fails
 *
 * @example
 * ```typescript
 * const results = await vectorOnlySearch('user authentication', store, {
 *   limit: 5,
 * });
 * ```
 */
export async function vectorOnlySearch(
  query: string,
  store: VectorStore,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = DEFAULT_LIMIT, fallbackToKeywordSearch = true, onProgress } = options;

  const startTime = Date.now();
  log.debug('Starting vector-only search', { query, limit });

  // Generate query embedding
  onProgress?.('Generating query embedding...');
  let queryVector: number[];
  try {
    const result = await embedQuery(query, { onProgress });
    queryVector = result.embedding;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Embedding generation failed', { error: message });

    // Fall back to keyword search if enabled
    if (fallbackToKeywordSearch && isEmbeddingError(error)) {
      log.info('Falling back to keyword-only search');
      const keywordResults = await keywordOnlySearch(query, store, options);
      const latency = Date.now() - startTime;
      metrics.recordSearch(latency, keywordResults.length, true);
      return keywordResults;
    }

    throw new EmbeddingGenerationError(
      `Failed to generate query embedding: ${message}`,
      error instanceof Error ? error : undefined
    );
  }

  // Vector search
  const filter = buildSafeFilter(options);
  onProgress?.(`Searching...`);
  const results = await store.vectorSearch(queryVector, limit, filter);

  const latency = Date.now() - startTime;
  metrics.recordSearch(latency, results.length, false);
  log.debug('Vector search complete', { resultCount: results.length, latencyMs: latency });

  return results;
}

/**
 * Format search results for human-readable display.
 *
 * Produces a formatted string with result rankings, scores, locations,
 * signatures, and code snippets.
 *
 * @param results - Array of hybrid search results
 * @returns Formatted string suitable for console output
 *
 * @example
 * ```typescript
 * const results = await hybridSearch('authentication', store);
 * console.log(formatSearchResults(results));
 *
 * // Output:
 * // 1. [85%] login (function_declaration)
 * //    /src/auth/login.ts:10-25
 * //    Signature: function login(user: string, password: string)
 * //    async function login(user, password) {
 * //      const valid = await verify(user, password);
 * //      ...
 * ```
 */
export function formatSearchResults(results: HybridSearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results
    .map((result, index) => {
      const { record, combinedScore } = result;
      const name = record.name || 'anonymous';
      const location = `${record.filePath}:${record.startLine}-${record.endLine}`;
      const scoreStr = (combinedScore * 100).toFixed(1);

      let output = `${index + 1}. [${scoreStr}%] ${name} (${record.nodeType})\n`;
      output += `   ${location}\n`;

      if (record.signature) {
        output += `   Signature: ${record.signature.slice(0, 80)}${record.signature.length > 80 ? '...' : ''}\n`;
      }

      // Show a snippet of the content
      const snippet = record.content
        .split('\n')
        .slice(0, 3)
        .join('\n')
        .slice(0, 150);
      output += `   ${snippet}${record.content.length > 150 ? '...' : ''}\n`;

      return output;
    })
    .join('\n');
}

export { rerank, boostKeywordMatches } from './reranker.js';
export { keywordOnlySearch, isEmbeddingError } from './keyword-search.js';
