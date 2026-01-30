/**
 * Cross-platform path utilities for semantic-code-mcp.
 *
 * Provides consistent path handling across Windows and Unix systems.
 *
 * @example
 * ```typescript
 * import { normalizePath, pathToChunkId, isWithinRoot } from './utils/paths.js';
 *
 * // Normalize paths to forward slashes
 * normalizePath('src\\utils\\index.ts'); // 'src/utils/index.ts'
 *
 * // Generate chunk IDs
 * pathToChunkId('src/utils/index.ts', 42); // 'src_utils_index_ts_L42'
 *
 * // Check if path is within root
 * isWithinRoot('/project/src/file.ts', '/project'); // true
 * isWithinRoot('../etc/passwd', '/project'); // false
 * ```
 *
 * @module utils/paths
 */

import * as path from 'path';

/**
 * Normalize a path to use forward slashes consistently.
 *
 * This is useful for generating consistent IDs and for display purposes
 * across different platforms.
 *
 * @param inputPath - The path to normalize
 * @returns Path with all backslashes replaced with forward slashes
 *
 * @example
 * ```typescript
 * normalizePath('src\\utils\\index.ts'); // 'src/utils/index.ts'
 * normalizePath('src/utils/index.ts');   // 'src/utils/index.ts'
 * normalizePath('C:\\Users\\code');      // 'C:/Users/code'
 * ```
 */
export function normalizePath(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * Convert a file path and line number to a chunk ID.
 *
 * Generates a safe, cross-platform ID suitable for use in database queries.
 * The ID format is: `{normalized_path}_L{line_number}` where the path has
 * all path separators and dots replaced with underscores.
 *
 * @param filePath - The source file path
 * @param startLine - The starting line number
 * @param suffix - Optional suffix for split chunks (e.g., '_p0')
 * @returns A safe chunk ID string
 *
 * @example
 * ```typescript
 * pathToChunkId('src/utils/index.ts', 42);           // 'src_utils_index_ts_L42'
 * pathToChunkId('src\\utils\\index.ts', 42);         // 'src_utils_index_ts_L42'
 * pathToChunkId('src/utils/index.ts', 42, '_p0');    // 'src_utils_index_ts_L42_p0'
 * ```
 */
export function pathToChunkId(filePath: string, startLine: number, suffix: string = ''): string {
  // Normalize path separators and replace dots with underscores
  const normalized = filePath
    .replace(/[\\/]/g, '_')
    .replace(/\./g, '_');

  return `${normalized}_L${startLine}${suffix}`;
}

/**
 * Check if a test path is within a root directory.
 *
 * This function prevents path traversal attacks by ensuring the resolved
 * path stays within the allowed root directory. It handles:
 * - Relative paths with `..` components
 * - Absolute paths
 * - Mixed path separators
 * - Case-insensitive comparison on Windows
 *
 * @param testPath - The path to validate (can be relative or absolute)
 * @param rootDir - The allowed root directory
 * @returns `true` if testPath resolves within rootDir
 *
 * @example
 * ```typescript
 * const root = '/home/user/project';
 *
 * // Safe paths
 * isWithinRoot('src/utils', root);           // true
 * isWithinRoot('/home/user/project/src', root); // true
 *
 * // Unsafe paths
 * isWithinRoot('../../../etc/passwd', root); // false
 * isWithinRoot('/etc/passwd', root);         // false
 * ```
 */
export function isWithinRoot(testPath: string, rootDir: string): boolean {
  const resolvedPath = path.resolve(rootDir, testPath);
  const resolvedRoot = path.resolve(rootDir);

  // On Windows, compare case-insensitively
  if (process.platform === 'win32') {
    const normalizedPath = resolvedPath.toLowerCase();
    const normalizedRoot = resolvedRoot.toLowerCase();
    return (
      normalizedPath.startsWith(normalizedRoot + path.sep.toLowerCase()) ||
      normalizedPath === normalizedRoot
    );
  }

  // On Unix, case-sensitive comparison
  return (
    resolvedPath.startsWith(resolvedRoot + path.sep) ||
    resolvedPath === resolvedRoot
  );
}

/**
 * Get the relative path from a root directory to a file.
 *
 * Returns the path with normalized forward slashes for consistent display.
 *
 * @param filePath - The absolute file path
 * @param rootDir - The root directory
 * @returns Relative path with forward slashes
 *
 * @example
 * ```typescript
 * getRelativePath('/project/src/index.ts', '/project'); // 'src/index.ts'
 * ```
 */
export function getRelativePath(filePath: string, rootDir: string): string {
  const relative = path.relative(rootDir, filePath);
  return normalizePath(relative);
}

/**
 * Join path segments with forward slashes.
 *
 * Useful for creating consistent paths for display or storage.
 *
 * @param segments - Path segments to join
 * @returns Joined path with forward slashes
 *
 * @example
 * ```typescript
 * joinPath('src', 'utils', 'index.ts'); // 'src/utils/index.ts'
 * ```
 */
export function joinPath(...segments: string[]): string {
  return normalizePath(path.join(...segments));
}

/**
 * Ensure a path has a trailing separator.
 *
 * Useful when building path prefixes for filtering.
 *
 * @param inputPath - The path to process
 * @returns Path with trailing forward slash
 *
 * @example
 * ```typescript
 * ensureTrailingSeparator('src/utils');  // 'src/utils/'
 * ensureTrailingSeparator('src/utils/'); // 'src/utils/'
 * ```
 */
export function ensureTrailingSeparator(inputPath: string): string {
  const normalized = normalizePath(inputPath);
  return normalized.endsWith('/') ? normalized : normalized + '/';
}

/**
 * Strip BOM (Byte Order Mark) from the beginning of a string.
 *
 * Some text editors add a UTF-8 BOM at the start of files, which can
 * interfere with parsing.
 *
 * @param content - The string content to process
 * @returns Content with BOM removed if present
 *
 * @example
 * ```typescript
 * stripBOM('\uFEFFfunction hello() {}'); // 'function hello() {}'
 * stripBOM('function hello() {}');       // 'function hello() {}'
 * ```
 */
export function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

/**
 * Extract the file extension from a path.
 *
 * @param filePath - The file path
 * @returns File extension including the dot, or empty string
 *
 * @example
 * ```typescript
 * getExtension('src/index.ts');     // '.ts'
 * getExtension('src/index.test.ts'); // '.ts'
 * getExtension('Makefile');          // ''
 * ```
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath);
}

/**
 * Get the filename without the directory path.
 *
 * @param filePath - The file path
 * @returns Just the filename
 *
 * @example
 * ```typescript
 * getFilename('src/utils/index.ts'); // 'index.ts'
 * ```
 */
export function getFilename(filePath: string): string {
  return path.basename(filePath);
}
