/**
 * WASM Tree-sitter loader for cross-platform code parsing.
 *
 * Handles initialization of web-tree-sitter runtime and loading of
 * language grammars from WASM files. Provides caching to avoid
 * redundant loading.
 *
 * @module chunker/wasm-loader
 */

import Parser from 'web-tree-sitter';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const log = createLogger('wasm-loader');

/** Whether the WASM runtime has been initialized */
let initialized = false;

/** Cache for loaded language grammars to avoid re-loading */
const languageCache = new Map<string, Parser.Language>();

/**
 * Get the directory containing the WASM grammar files.
 *
 * Grammars are stored in the `grammars/` directory relative to the
 * package root (or dist/ when built).
 */
function getGrammarsDir(): string {
  // Get the directory of the current module
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);

  // Navigate up from src/chunker or dist/chunker to find grammars/
  // In development: src/chunker -> src -> project root -> grammars
  // In production: dist/chunker -> dist -> project root -> grammars
  const projectRoot = path.resolve(currentDir, '..', '..');
  return path.join(projectRoot, 'grammars');
}

/**
 * Initialize the web-tree-sitter WASM runtime.
 *
 * This must be called once before any parsing operations.
 * Subsequent calls are no-ops.
 *
 * @throws Error if WASM runtime fails to initialize
 */
export async function initParser(): Promise<void> {
  if (initialized) {
    return;
  }

  log.debug('Initializing web-tree-sitter WASM runtime');
  await Parser.init();
  initialized = true;
  log.debug('WASM runtime initialized');
}

/**
 * Load a language grammar from a WASM file.
 *
 * Uses caching to avoid reloading the same grammar multiple times.
 *
 * @param wasmFileName - The WASM file name (e.g., 'tree-sitter-typescript.wasm')
 * @returns The loaded language grammar
 * @throws Error if the grammar file cannot be loaded
 */
export async function loadLanguage(wasmFileName: string): Promise<Parser.Language> {
  // Check cache first
  if (languageCache.has(wasmFileName)) {
    return languageCache.get(wasmFileName)!;
  }

  // Ensure WASM runtime is initialized
  await initParser();

  const grammarsDir = getGrammarsDir();
  const wasmPath = path.join(grammarsDir, wasmFileName);

  log.debug('Loading language grammar', { wasmPath });

  try {
    const language = await Parser.Language.load(wasmPath);
    languageCache.set(wasmFileName, language);
    log.debug('Language loaded successfully', { wasmFileName });
    return language;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to load language grammar', { wasmPath, error: errorMessage });
    throw new Error(`Failed to load grammar ${wasmFileName}: ${errorMessage}`);
  }
}

/**
 * Create a new parser instance with the specified language.
 *
 * @param wasmFileName - The WASM file name for the language
 * @returns A configured parser ready for use
 */
export async function createParser(wasmFileName: string): Promise<Parser> {
  const language = await loadLanguage(wasmFileName);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

/**
 * Check if a language grammar is already loaded.
 *
 * @param wasmFileName - The WASM file name to check
 * @returns True if the grammar is cached
 */
export function isLanguageLoaded(wasmFileName: string): boolean {
  return languageCache.has(wasmFileName);
}

/**
 * Clear the language cache.
 *
 * Useful for testing or when memory needs to be freed.
 */
export function clearLanguageCache(): void {
  languageCache.clear();
  log.debug('Language cache cleared');
}

/**
 * Get the number of cached languages.
 */
export function getCacheSize(): number {
  return languageCache.size;
}
