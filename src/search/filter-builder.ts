/**
 * Safe SQL filter builder for LanceDB queries.
 * Prevents SQL injection by validating and sanitizing filter inputs.
 */

import { InvalidFilterError } from '../errors.js';

/**
 * Whitelist pattern for safe filter values.
 * Allows alphanumeric characters, underscores, hyphens, and percent signs (for LIKE patterns).
 */
const SAFE_PATTERN = /^[a-zA-Z0-9_\-%]+$/;

/**
 * Maximum length for filter values to prevent DoS
 */
const MAX_FILTER_VALUE_LENGTH = 500;

/**
 * Validate that a pattern is safe for use in SQL filters
 */
export function validateFilterPattern(pattern: string): boolean {
  if (pattern.length > MAX_FILTER_VALUE_LENGTH) {
    return false;
  }
  return SAFE_PATTERN.test(pattern);
}

/**
 * Sanitize a path for use in LIKE patterns.
 * Converts path separators and dots to underscores.
 */
export function sanitizePathPattern(path: string): string {
  // Replace path separators and dots with underscores
  const sanitized = path
    .replace(/[\\\/]/g, '_')
    .replace(/\./g, '_');

  // Validate the result
  if (!validateFilterPattern(sanitized)) {
    throw new InvalidFilterError(
      `Invalid path pattern: contains disallowed characters`
    );
  }

  return sanitized;
}

/**
 * Sanitize a glob pattern for use in LIKE patterns.
 * Converts glob wildcards to SQL LIKE wildcards.
 */
export function sanitizeGlobPattern(pattern: string): string {
  // Convert glob patterns to SQL LIKE patterns
  let sanitized = pattern
    .replace(/\*\*/g, '%')      // ** -> %
    .replace(/\*/g, '%')         // * -> %
    .replace(/\?/g, '_')         // ? -> _
    .replace(/[\\\/]/g, '_')     // path separators -> _
    .replace(/\./g, '_');        // . -> _

  // Validate the result
  if (!validateFilterPattern(sanitized)) {
    throw new InvalidFilterError(
      `Invalid file pattern: contains disallowed characters`
    );
  }

  return sanitized;
}

/**
 * Build a safe LIKE condition for path filtering
 */
export function buildPathLikeCondition(pathPattern: string): string {
  const sanitized = sanitizePathPattern(pathPattern);
  return `id LIKE '${sanitized}%'`;
}

/**
 * Build a safe equality condition for language filtering
 */
export function buildLanguageCondition(language: string): string {
  // Language names are very constrained
  if (!/^[a-z]+$/.test(language)) {
    throw new InvalidFilterError(`Invalid language name: ${language}`);
  }
  return `language = '${language}'`;
}

/**
 * Build a safe LIKE condition for file pattern filtering
 */
export function buildFilePatternCondition(pattern: string): string {
  const sanitized = sanitizeGlobPattern(pattern);
  return `id LIKE '%${sanitized}'`;
}

// Map file extensions to language names used in the index
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.go': 'go',
  '.rs': 'rust',
};

export interface FilterOptions {
  /** Optional directory path prefix */
  path?: string;
  /** Optional file pattern (glob) */
  filePattern?: string;
}

/**
 * Build a safe SQL filter string from search options.
 * Returns undefined if no filters are specified.
 */
export function buildSafeFilter(options: FilterOptions): string | undefined {
  const conditions: string[] = [];

  if (options.path) {
    conditions.push(buildPathLikeCondition(options.path));
  }

  if (options.filePattern) {
    // Check if it's a simple extension pattern like "*.py" or "*.ts"
    const extMatch = options.filePattern.match(/^\*(\.[a-z]+)$/i);
    if (extMatch && extMatch[1]) {
      const ext = extMatch[1].toLowerCase();
      const lang = EXTENSION_TO_LANGUAGE[ext];
      if (lang) {
        // Use language field for better performance and reliability
        conditions.push(buildLanguageCondition(lang));
      }
    } else {
      // For complex patterns, convert to id-based LIKE pattern
      conditions.push(buildFilePatternCondition(options.filePattern));
    }
  }

  return conditions.length > 0 ? conditions.join(' AND ') : undefined;
}
