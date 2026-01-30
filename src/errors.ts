/**
 * Custom error types for semantic-code-mcp.
 * Provides typed errors for better error handling and debugging.
 */

/**
 * Base error class for embedder-related errors
 */
export class EmbedderError extends Error {
  cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'EmbedderError';
    this.cause = cause;
  }
}

/**
 * Error thrown when the embedding model fails to load
 */
export class ModelLoadError extends EmbedderError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'ModelLoadError';
  }
}

/**
 * Error thrown when embedding generation fails
 */
export class EmbeddingGenerationError extends EmbedderError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'EmbeddingGenerationError';
  }
}

/**
 * Error thrown for security validation failures
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Error thrown for path traversal attempts
 */
export class PathTraversalError extends SecurityError {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Error thrown for invalid filter patterns (potential SQL injection)
 */
export class InvalidFilterError extends SecurityError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFilterError';
  }
}

/**
 * Error thrown for invalid ID format
 */
export class InvalidIdError extends SecurityError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidIdError';
  }
}
