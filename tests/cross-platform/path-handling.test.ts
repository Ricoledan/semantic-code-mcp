/**
 * Cross-platform path handling tests.
 *
 * Tests for Windows-style paths, mixed separators, and case sensitivity.
 */

import {
  normalizePath,
  pathToChunkId,
  isWithinRoot,
  getRelativePath,
  joinPath,
  ensureTrailingSeparator,
  stripBOM,
  getExtension,
  getFilename,
} from '../../src/utils/paths.js';

describe('Cross-Platform Path Handling', () => {
  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizePath('src\\utils\\index.ts')).toBe('src/utils/index.ts');
    });

    it('should leave forward slashes unchanged', () => {
      expect(normalizePath('src/utils/index.ts')).toBe('src/utils/index.ts');
    });

    it('should handle mixed separators', () => {
      expect(normalizePath('src\\utils/helpers\\index.ts')).toBe('src/utils/helpers/index.ts');
    });

    it('should handle Windows drive letters', () => {
      expect(normalizePath('C:\\Users\\code\\project')).toBe('C:/Users/code/project');
    });

    it('should handle UNC paths', () => {
      expect(normalizePath('\\\\server\\share\\folder')).toBe('//server/share/folder');
    });

    it('should handle empty string', () => {
      expect(normalizePath('')).toBe('');
    });

    it('should handle single segment', () => {
      expect(normalizePath('filename.ts')).toBe('filename.ts');
    });
  });

  describe('pathToChunkId', () => {
    it('should convert Unix path to chunk ID', () => {
      expect(pathToChunkId('src/utils/index.ts', 42)).toBe('src_utils_index_ts_L42');
    });

    it('should convert Windows path to chunk ID', () => {
      expect(pathToChunkId('src\\utils\\index.ts', 42)).toBe('src_utils_index_ts_L42');
    });

    it('should handle mixed separators', () => {
      expect(pathToChunkId('src\\utils/index.ts', 42)).toBe('src_utils_index_ts_L42');
    });

    it('should handle file with multiple dots', () => {
      expect(pathToChunkId('src/utils/index.test.ts', 10)).toBe('src_utils_index_test_ts_L10');
    });

    it('should handle suffix for split chunks', () => {
      expect(pathToChunkId('src/index.ts', 42, '_p0')).toBe('src_index_ts_L42_p0');
    });

    it('should handle hyphenated filenames', () => {
      expect(pathToChunkId('src/my-component.tsx', 1)).toBe('src_my-component_tsx_L1');
    });

    it('should produce consistent IDs across platforms', () => {
      const unixId = pathToChunkId('src/utils/index.ts', 42);
      const windowsId = pathToChunkId('src\\utils\\index.ts', 42);
      expect(unixId).toBe(windowsId);
    });
  });

  describe('isWithinRoot', () => {
    const root = '/home/user/project';

    it('should allow paths within root', () => {
      expect(isWithinRoot('src/utils', root)).toBe(true);
      expect(isWithinRoot('src/utils/index.ts', root)).toBe(true);
      expect(isWithinRoot('.', root)).toBe(true);
    });

    it('should allow absolute paths within root', () => {
      expect(isWithinRoot('/home/user/project/src', root)).toBe(true);
      expect(isWithinRoot('/home/user/project/src/index.ts', root)).toBe(true);
    });

    it('should block path traversal attempts', () => {
      expect(isWithinRoot('../../../etc/passwd', root)).toBe(false);
      expect(isWithinRoot('src/../../etc/passwd', root)).toBe(false);
      expect(isWithinRoot('..', root)).toBe(false);
    });

    it('should block absolute paths outside root', () => {
      expect(isWithinRoot('/etc/passwd', root)).toBe(false);
      expect(isWithinRoot('/home/other/project', root)).toBe(false);
    });

    it('should block sibling directory with shared prefix', () => {
      expect(isWithinRoot('/home/user/project2', root)).toBe(false);
      expect(isWithinRoot('/home/user/project-other', root)).toBe(false);
    });

    it('should handle Windows-style paths', () => {
      // Note: On Unix, backslashes are valid path characters, not separators
      // This test validates the behavior on the current platform
      const winRoot = 'C:\\Users\\code\\project';
      expect(isWithinRoot('src\\utils', winRoot)).toBe(true);
      // On Unix, this resolves differently than on Windows
      // The test is platform-specific
    });

    it('should handle empty test path', () => {
      expect(isWithinRoot('', root)).toBe(true); // Resolves to root itself
    });
  });

  describe('getRelativePath', () => {
    it('should get relative path from root', () => {
      const relative = getRelativePath('/project/src/index.ts', '/project');
      expect(relative).toBe('src/index.ts');
    });

    it('should normalize separators in result', () => {
      // This behavior depends on the platform
      const relative = getRelativePath('/project/src/utils/index.ts', '/project');
      expect(relative).not.toContain('\\');
    });

    it('should handle same directory', () => {
      const relative = getRelativePath('/project/file.ts', '/project');
      expect(relative).toBe('file.ts');
    });
  });

  describe('joinPath', () => {
    it('should join path segments with forward slashes', () => {
      expect(joinPath('src', 'utils', 'index.ts')).toBe('src/utils/index.ts');
    });

    it('should handle segments with existing separators', () => {
      const result = joinPath('src/', 'utils', '/index.ts');
      expect(result).not.toContain('\\');
    });

    it('should handle empty segments', () => {
      expect(joinPath('src', '', 'index.ts')).toBe('src/index.ts');
    });
  });

  describe('ensureTrailingSeparator', () => {
    it('should add trailing slash if missing', () => {
      expect(ensureTrailingSeparator('src/utils')).toBe('src/utils/');
    });

    it('should not duplicate existing trailing slash', () => {
      expect(ensureTrailingSeparator('src/utils/')).toBe('src/utils/');
    });

    it('should normalize Windows backslash', () => {
      expect(ensureTrailingSeparator('src\\utils')).toBe('src/utils/');
    });

    it('should handle empty string', () => {
      expect(ensureTrailingSeparator('')).toBe('/');
    });
  });

  describe('stripBOM', () => {
    it('should strip UTF-8 BOM', () => {
      expect(stripBOM('\uFEFFcontent')).toBe('content');
    });

    it('should leave content without BOM unchanged', () => {
      expect(stripBOM('content')).toBe('content');
    });

    it('should handle empty string', () => {
      expect(stripBOM('')).toBe('');
    });

    it('should only strip leading BOM', () => {
      expect(stripBOM('\uFEFFstart\uFEFFmiddle')).toBe('start\uFEFFmiddle');
    });
  });

  describe('getExtension', () => {
    it('should extract file extension', () => {
      expect(getExtension('index.ts')).toBe('.ts');
      expect(getExtension('src/index.ts')).toBe('.ts');
    });

    it('should handle multiple dots', () => {
      expect(getExtension('index.test.ts')).toBe('.ts');
      expect(getExtension('file.tar.gz')).toBe('.gz');
    });

    it('should handle no extension', () => {
      expect(getExtension('Makefile')).toBe('');
      expect(getExtension('.gitignore')).toBe('');
    });

    it('should handle Windows paths', () => {
      expect(getExtension('src\\utils\\index.ts')).toBe('.ts');
    });
  });

  describe('getFilename', () => {
    it('should extract filename from path', () => {
      expect(getFilename('src/utils/index.ts')).toBe('index.ts');
    });

    it('should handle Windows paths', () => {
      // On Unix, backslash is a valid filename character
      // On Windows, this would return 'index.ts'
      // path.basename uses platform-specific separator
      if (process.platform === 'win32') {
        expect(getFilename('src\\utils\\index.ts')).toBe('index.ts');
      } else {
        // On Unix, the whole string is the filename
        expect(getFilename('src\\utils\\index.ts')).toBe('src\\utils\\index.ts');
      }
    });

    it('should handle filename only', () => {
      expect(getFilename('index.ts')).toBe('index.ts');
    });

    it('should handle trailing separator', () => {
      expect(getFilename('src/utils/')).toBe('utils');
    });
  });

  describe('Windows-Specific Scenarios', () => {
    it('should handle Windows drive letters in paths', () => {
      const normalized = normalizePath('C:\\Users\\code\\project\\src\\index.ts');
      expect(normalized).toBe('C:/Users/code/project/src/index.ts');

      const chunkId = pathToChunkId('C:\\Users\\code\\project\\src\\index.ts', 1);
      // Note: The colon in drive letter becomes underscore but stays as single underscore
      expect(chunkId).toBe('C:_Users_code_project_src_index_ts_L1');
    });

    it('should handle network paths (UNC)', () => {
      const normalized = normalizePath('\\\\server\\share\\project\\src');
      expect(normalized).toBe('//server/share/project/src');
    });

    it('should handle mixed forward and back slashes', () => {
      const normalized = normalizePath('C:\\Users/code\\project/src');
      expect(normalized).toBe('C:/Users/code/project/src');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(100) + 'file.ts';
      const normalized = normalizePath(longPath);
      expect(normalized).toBe(longPath);

      const chunkId = pathToChunkId(longPath, 1);
      expect(chunkId.length).toBeGreaterThan(100);
    });

    it('should handle paths with special characters', () => {
      const path = 'src/my file (copy).ts';
      const normalized = normalizePath(path);
      expect(normalized).toBe(path);
    });

    it('should handle Unicode in paths', () => {
      const path = 'src/コード/index.ts';
      const normalized = normalizePath(path);
      expect(normalized).toBe(path);

      const chunkId = pathToChunkId(path, 1);
      expect(chunkId).toContain('コード');
    });

    it('should handle paths with dots only', () => {
      expect(normalizePath('.')).toBe('.');
      expect(normalizePath('..')).toBe('..');
      expect(normalizePath('./.')).toBe('./.');
    });
  });
});
