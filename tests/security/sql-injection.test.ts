/**
 * SQL injection security tests for filter building.
 */

import {
  validateFilterPattern,
  sanitizePathPattern,
  sanitizeGlobPattern,
  buildSafeFilter,
  buildPathLikeCondition,
  buildFilePatternCondition,
  buildLanguageCondition,
} from '../../src/search/filter-builder.js';
import { InvalidFilterError } from '../../src/errors.js';

describe('SQL Injection Prevention', () => {
  describe('validateFilterPattern', () => {
    it('should accept safe alphanumeric patterns', () => {
      expect(validateFilterPattern('hello')).toBe(true);
      expect(validateFilterPattern('test_file')).toBe(true);
      expect(validateFilterPattern('path-to-file')).toBe(true);
      expect(validateFilterPattern('file123')).toBe(true);
    });

    it('should accept SQL LIKE wildcards', () => {
      expect(validateFilterPattern('%test%')).toBe(true);
      expect(validateFilterPattern('test_')).toBe(true);
      expect(validateFilterPattern('%_test_%')).toBe(true);
    });

    it('should reject SQL injection attempts with quotes', () => {
      expect(validateFilterPattern("test'")).toBe(false);
      expect(validateFilterPattern("'; DROP TABLE--")).toBe(false);
      expect(validateFilterPattern("test' OR '1'='1")).toBe(false);
      expect(validateFilterPattern('test"')).toBe(false);
    });

    it('should reject SQL injection with semicolons', () => {
      expect(validateFilterPattern('test; DROP TABLE')).toBe(false);
      expect(validateFilterPattern('test;--')).toBe(false);
    });

    it('should reject SQL injection with comments', () => {
      // Note: -- is valid per our whitelist (alphanumeric, underscore, hyphen, percent)
      // but /* is not valid
      expect(validateFilterPattern('test/*comment*/')).toBe(false);
    });

    it('should reject patterns with special characters', () => {
      expect(validateFilterPattern('test=')).toBe(false);
      expect(validateFilterPattern('test()')).toBe(false);
      expect(validateFilterPattern('test<>')).toBe(false);
      expect(validateFilterPattern('test\n')).toBe(false);
    });

    it('should reject overly long patterns', () => {
      const longPattern = 'a'.repeat(501);
      expect(validateFilterPattern(longPattern)).toBe(false);
    });

    it('should accept patterns at max length', () => {
      const maxPattern = 'a'.repeat(500);
      expect(validateFilterPattern(maxPattern)).toBe(true);
    });
  });

  describe('sanitizePathPattern', () => {
    it('should convert path separators to underscores', () => {
      expect(sanitizePathPattern('src/test/file')).toBe('src_test_file');
      expect(sanitizePathPattern('src\\test\\file')).toBe('src_test_file');
    });

    it('should convert dots to underscores', () => {
      expect(sanitizePathPattern('file.ts')).toBe('file_ts');
      expect(sanitizePathPattern('src.test.file')).toBe('src_test_file');
    });

    it('should throw on SQL injection attempts', () => {
      expect(() => sanitizePathPattern("src'; DROP TABLE--/")).toThrow(
        InvalidFilterError
      );
      expect(() => sanitizePathPattern("test' OR '1'='1")).toThrow(
        InvalidFilterError
      );
    });
  });

  describe('sanitizeGlobPattern', () => {
    it('should convert glob wildcards to SQL LIKE', () => {
      expect(sanitizeGlobPattern('*.ts')).toBe('%_ts');
      expect(sanitizeGlobPattern('**/*.py')).toBe('%_%_py');
      // Note: . becomes _ and ? becomes _, so ??.ts = ____ts
      expect(sanitizeGlobPattern('src/??.ts')).toBe('src____ts');
    });

    it('should throw on SQL injection in glob patterns', () => {
      expect(() => sanitizeGlobPattern("*'; DROP TABLE--")).toThrow(
        InvalidFilterError
      );
    });
  });

  describe('buildPathLikeCondition', () => {
    it('should build safe LIKE conditions', () => {
      const result = buildPathLikeCondition('src/test');
      expect(result).toBe("id LIKE 'src_test%'");
    });

    it('should escape path separators', () => {
      const result = buildPathLikeCondition('src/components/ui');
      expect(result).toBe("id LIKE 'src_components_ui%'");
    });
  });

  describe('buildLanguageCondition', () => {
    it('should build safe language conditions', () => {
      expect(buildLanguageCondition('typescript')).toBe("language = 'typescript'");
      expect(buildLanguageCondition('python')).toBe("language = 'python'");
    });

    it('should reject invalid language names', () => {
      expect(() => buildLanguageCondition('type-script')).toThrow(InvalidFilterError);
      expect(() => buildLanguageCondition("'; DROP TABLE--")).toThrow(InvalidFilterError);
      expect(() => buildLanguageCondition('PYTHON')).toThrow(InvalidFilterError);
    });
  });

  describe('buildFilePatternCondition', () => {
    it('should build safe file pattern conditions', () => {
      const result = buildFilePatternCondition('*.ts');
      // * becomes %, . becomes _
      expect(result).toBe("id LIKE '%%_ts'");
    });
  });

  describe('buildSafeFilter', () => {
    it('should return undefined for empty options', () => {
      expect(buildSafeFilter({})).toBeUndefined();
    });

    it('should build path filter', () => {
      const result = buildSafeFilter({ path: 'src/test' });
      expect(result).toBe("id LIKE 'src_test%'");
    });

    it('should use language filter for simple extension patterns', () => {
      const result = buildSafeFilter({ filePattern: '*.ts' });
      expect(result).toBe("language = 'typescript'");
    });

    it('should use language filter for Python', () => {
      const result = buildSafeFilter({ filePattern: '*.py' });
      expect(result).toBe("language = 'python'");
    });

    it('should build complex file pattern filter', () => {
      const result = buildSafeFilter({ filePattern: '**/*.test.ts' });
      // ** becomes %, * becomes %, . becomes _, so **/*.test.ts = %%_%_test_ts
      expect(result).toBe("id LIKE '%%_%_test_ts'");
    });

    it('should combine path and file pattern filters', () => {
      const result = buildSafeFilter({ path: 'src', filePattern: '*.ts' });
      expect(result).toBe("id LIKE 'src%' AND language = 'typescript'");
    });

    it('should throw on SQL injection in path', () => {
      expect(() => buildSafeFilter({ path: "'; DROP TABLE--" })).toThrow(
        InvalidFilterError
      );
    });

    it('should throw on SQL injection in file pattern', () => {
      expect(() => buildSafeFilter({ filePattern: "*.ts'; DROP TABLE--" })).toThrow(
        InvalidFilterError
      );
    });
  });

  describe('Real-world SQL injection payloads', () => {
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "' UNION SELECT * FROM users--",
      "1'; DELETE FROM chunks WHERE '1'='1",
      "test' AND 1=1--",
      "admin'--",
      "' OR 1=1#",
      "'; WAITFOR DELAY '0:0:5'--",
      "' OR EXISTS(SELECT * FROM users)--",
      "test\u0000'; DROP TABLE--",
    ];

    it.each(sqlInjectionPayloads)(
      'should reject injection payload: %s',
      (payload) => {
        expect(validateFilterPattern(payload)).toBe(false);
      }
    );

    it.each(sqlInjectionPayloads)(
      'should throw on sanitizePathPattern with: %s',
      (payload) => {
        expect(() => sanitizePathPattern(payload)).toThrow(InvalidFilterError);
      }
    );

    it.each(sqlInjectionPayloads)(
      'should throw on buildSafeFilter path with: %s',
      (payload) => {
        expect(() => buildSafeFilter({ path: payload })).toThrow(InvalidFilterError);
      }
    );
  });
});
