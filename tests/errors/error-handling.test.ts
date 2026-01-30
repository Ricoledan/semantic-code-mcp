/**
 * Tests for custom error types and error handling.
 */

import {
  EmbedderError,
  ModelLoadError,
  EmbeddingGenerationError,
  SecurityError,
  PathTraversalError,
  InvalidFilterError,
  InvalidIdError,
} from '../../src/errors.js';

describe('Error Types', () => {
  describe('EmbedderError', () => {
    it('should create error with message', () => {
      const error = new EmbedderError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('EmbedderError');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(EmbedderError);
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new EmbedderError('Wrapper error', cause);

      expect(error.message).toBe('Wrapper error');
      expect(error.cause).toBe(cause);
    });

    it('should work without cause', () => {
      const error = new EmbedderError('No cause');

      expect(error.cause).toBeUndefined();
    });
  });

  describe('ModelLoadError', () => {
    it('should extend EmbedderError', () => {
      const error = new ModelLoadError('Model load failed');

      expect(error).toBeInstanceOf(EmbedderError);
      expect(error).toBeInstanceOf(ModelLoadError);
      expect(error.name).toBe('ModelLoadError');
    });

    it('should include cause in error chain', () => {
      const networkError = new Error('Network timeout');
      const error = new ModelLoadError('Failed to load model', networkError);

      expect(error.cause).toBe(networkError);
      expect(error.cause?.message).toBe('Network timeout');
    });
  });

  describe('EmbeddingGenerationError', () => {
    it('should extend EmbedderError', () => {
      const error = new EmbeddingGenerationError('Embedding failed');

      expect(error).toBeInstanceOf(EmbedderError);
      expect(error).toBeInstanceOf(EmbeddingGenerationError);
      expect(error.name).toBe('EmbeddingGenerationError');
    });

    it('should preserve error context', () => {
      const runtimeError = new TypeError('Invalid input');
      const error = new EmbeddingGenerationError(
        'Failed to generate embedding',
        runtimeError
      );

      expect(error.message).toBe('Failed to generate embedding');
      expect(error.cause).toBe(runtimeError);
    });
  });

  describe('SecurityError', () => {
    it('should create security error', () => {
      const error = new SecurityError('Security violation');

      expect(error.message).toBe('Security violation');
      expect(error.name).toBe('SecurityError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('PathTraversalError', () => {
    it('should extend SecurityError', () => {
      const error = new PathTraversalError('Path traversal detected');

      expect(error).toBeInstanceOf(SecurityError);
      expect(error).toBeInstanceOf(PathTraversalError);
      expect(error.name).toBe('PathTraversalError');
    });

    it('should contain descriptive message', () => {
      const error = new PathTraversalError(
        'Attempted access to /etc/passwd via ../../../'
      );

      expect(error.message).toContain('/etc/passwd');
      expect(error.message).toContain('../../../');
    });
  });

  describe('InvalidFilterError', () => {
    it('should extend SecurityError', () => {
      const error = new InvalidFilterError('Invalid filter pattern');

      expect(error).toBeInstanceOf(SecurityError);
      expect(error).toBeInstanceOf(InvalidFilterError);
      expect(error.name).toBe('InvalidFilterError');
    });

    it('should describe the invalid pattern', () => {
      const error = new InvalidFilterError(
        "Pattern contains SQL injection: '; DROP TABLE--"
      );

      expect(error.message).toContain('SQL injection');
    });
  });

  describe('InvalidIdError', () => {
    it('should extend SecurityError', () => {
      const error = new InvalidIdError('Invalid ID format');

      expect(error).toBeInstanceOf(SecurityError);
      expect(error).toBeInstanceOf(InvalidIdError);
      expect(error.name).toBe('InvalidIdError');
    });

    it('should describe the invalid ID', () => {
      const error = new InvalidIdError(
        "ID contains invalid characters: test'; DROP TABLE"
      );

      expect(error.message).toContain('invalid characters');
    });
  });

  describe('Error inheritance chain', () => {
    it('should allow catching by parent type', () => {
      const embedderError = new EmbedderError('Generic embedder error');
      const modelError = new ModelLoadError('Model error');
      const embeddingError = new EmbeddingGenerationError('Embedding error');

      // All should be caught by EmbedderError catch
      const embedderErrors = [embedderError, modelError, embeddingError];
      for (const error of embedderErrors) {
        expect(error).toBeInstanceOf(EmbedderError);
      }

      const securityError = new SecurityError('Security error');
      const pathError = new PathTraversalError('Path error');
      const filterError = new InvalidFilterError('Filter error');
      const idError = new InvalidIdError('ID error');

      // All should be caught by SecurityError catch
      const securityErrors = [securityError, pathError, filterError, idError];
      for (const error of securityErrors) {
        expect(error).toBeInstanceOf(SecurityError);
      }
    });

    it('should allow distinguishing specific error types', () => {
      const errors = [
        new ModelLoadError('Model'),
        new EmbeddingGenerationError('Embedding'),
        new PathTraversalError('Path'),
        new InvalidFilterError('Filter'),
        new InvalidIdError('ID'),
      ];

      let modelCount = 0;
      let embeddingCount = 0;
      let pathCount = 0;
      let filterCount = 0;
      let idCount = 0;

      for (const error of errors) {
        if (error instanceof ModelLoadError) modelCount++;
        if (error instanceof EmbeddingGenerationError) embeddingCount++;
        if (error instanceof PathTraversalError) pathCount++;
        if (error instanceof InvalidFilterError) filterCount++;
        if (error instanceof InvalidIdError) idCount++;
      }

      expect(modelCount).toBe(1);
      expect(embeddingCount).toBe(1);
      expect(pathCount).toBe(1);
      expect(filterCount).toBe(1);
      expect(idCount).toBe(1);
    });
  });

  describe('Error message formatting', () => {
    it('should support string interpolation in messages', () => {
      const model = 'nomic-embed-text';
      const error = new ModelLoadError(`Failed to load model: ${model}`);

      expect(error.message).toBe('Failed to load model: nomic-embed-text');
    });

    it('should support multi-line messages', () => {
      const error = new EmbedderError(
        'Error occurred:\n  - Detail 1\n  - Detail 2'
      );

      expect(error.message).toContain('Detail 1');
      expect(error.message).toContain('Detail 2');
    });
  });

  describe('Error serialization', () => {
    it('should serialize to JSON correctly', () => {
      const cause = new Error('Original');
      const error = new ModelLoadError('Load failed', cause);

      const json = JSON.stringify({
        name: error.name,
        message: error.message,
        cause: error.cause?.message,
      });

      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('ModelLoadError');
      expect(parsed.message).toBe('Load failed');
      expect(parsed.cause).toBe('Original');
    });
  });
});
