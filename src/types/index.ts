/**
 * Centralized type definitions for semantic-code-mcp.
 *
 * This module provides a clear separation between:
 * - **External types**: Used in MCP tool interfaces (snake_case per MCP convention)
 * - **Internal types**: Used within the codebase (camelCase per TypeScript convention)
 *
 * @module types
 */

// Re-export types from existing modules for convenience
export type { CodeChunk } from '../chunker/index.js';
export type { VectorRecord, SearchResult, StoreOptions } from '../store/index.js';
export type { EmbeddingResult, EmbedderOptions, BatchEmbeddingResult } from '../embedder/index.js';
export type { SearchOptions, HybridSearchResult } from '../search/index.js';
export type { IndexerOptions, IndexStats } from '../watcher/index.js';
export type { LogLevel, LogEntry, LoggerOptions, ComponentLogger } from '../utils/logger.js';
export type { IndexingMetrics, SearchMetrics, MetricsSummary } from '../utils/metrics.js';

/**
 * External API types (MCP interface).
 * These use snake_case to match MCP protocol conventions.
 */
export interface ExternalSearchInput {
  /** Natural language search query */
  query: string;
  /** Optional directory path to scope the search */
  path?: string;
  /** Maximum number of results (default: 10, max: 50) */
  limit?: number;
  /** Optional glob pattern to filter files */
  file_pattern?: string;
}

/**
 * External search result format (MCP response).
 */
export interface ExternalSearchResult {
  /** Source file path */
  file: string;
  /** Starting line number (1-indexed) */
  start_line: number;
  /** Ending line number (1-indexed) */
  end_line: number;
  /** Function/class name if available */
  name: string | null;
  /** AST node type */
  node_type: string;
  /** Relevance score (0-1) */
  score: number;
  /** Code content */
  content: string;
  /** Function signature if available */
  signature: string | null;
}

/**
 * External search output format (MCP response).
 */
export interface ExternalSearchOutput {
  results: ExternalSearchResult[];
  total_results: number;
  query: string;
  index_stats: {
    total_chunks: number;
    indexed: boolean;
  };
}

/**
 * Internal API types (camelCase).
 * These are used within the codebase.
 */
export interface InternalSearchInput {
  /** Natural language search query */
  query: string;
  /** Optional directory path to scope the search */
  path?: string;
  /** Maximum number of results */
  limit?: number;
  /** Optional glob pattern to filter files */
  filePattern?: string;
}

/**
 * Internal search result format.
 */
export interface InternalSearchResult {
  /** Source file path */
  file: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Function/class name if available */
  name: string | null;
  /** AST node type */
  nodeType: string;
  /** Relevance score (0-1) */
  score: number;
  /** Code content */
  content: string;
  /** Function signature if available */
  signature: string | null;
}

/**
 * Convert external (MCP) input to internal format.
 *
 * @param external - External input with snake_case keys
 * @returns Internal input with camelCase keys
 */
export function toInternalInput(external: ExternalSearchInput): InternalSearchInput {
  return {
    query: external.query,
    path: external.path,
    limit: external.limit,
    filePattern: external.file_pattern,
  };
}

/**
 * Convert internal result to external (MCP) format.
 *
 * @param internal - Internal result with camelCase keys
 * @returns External result with snake_case keys
 */
export function toExternalResult(internal: InternalSearchResult): ExternalSearchResult {
  return {
    file: internal.file,
    start_line: internal.startLine,
    end_line: internal.endLine,
    name: internal.name,
    node_type: internal.nodeType,
    score: internal.score,
    content: internal.content,
    signature: internal.signature,
  };
}

/**
 * Convert multiple internal results to external format.
 *
 * @param results - Array of internal results
 * @returns Array of external results
 */
export function toExternalResults(results: InternalSearchResult[]): ExternalSearchResult[] {
  return results.map(toExternalResult);
}

/**
 * Supported programming languages.
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust';

/**
 * File extension to language mapping.
 */
export const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
};

/**
 * Check if a file extension is supported.
 *
 * @param ext - File extension (including dot)
 * @returns true if the extension is supported
 */
export function isSupportedExtension(ext: string): boolean {
  return ext in EXTENSION_TO_LANGUAGE;
}

/**
 * Get the language for a file extension.
 *
 * @param ext - File extension (including dot)
 * @returns Language name or undefined if not supported
 */
export function getLanguageForExtension(ext: string): SupportedLanguage | undefined {
  return EXTENSION_TO_LANGUAGE[ext];
}
