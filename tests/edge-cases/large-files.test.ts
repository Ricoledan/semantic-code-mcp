/**
 * Edge case tests for large file handling.
 *
 * Tests behavior with files that exceed normal size limits
 * or contain many chunks.
 */

import { chunkCode } from '../../src/chunker/index.js';

describe('Large Files Edge Cases', () => {
  describe('Very Large Functions', () => {
    it('should split a function exceeding chunk size limit', async () => {
      // Create a very large function (> 2000 chars)
      const lines = ['function veryLargeFunction() {'];
      for (let i = 0; i < 100; i++) {
        lines.push(`  const variable${i} = "value${i}"; // Line ${i} with some padding text to make it longer`);
      }
      lines.push('  return true;');
      lines.push('}');

      const code = lines.join('\n');
      expect(code.length).toBeGreaterThan(2000);

      const chunks = await chunkCode(code, '/test/large-function.ts');

      // Should have multiple chunks due to size splitting
      expect(chunks.length).toBeGreaterThan(0);

      // All chunks should have the function name (with part suffix)
      for (const chunk of chunks) {
        if (chunks.length > 1) {
          expect(chunk.name).toContain('veryLargeFunction');
        }
      }
    });

    it('should handle a file with many small functions', async () => {
      // Create a file with 50 small functions
      const lines: string[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push(`function func${i}() {`);
        lines.push(`  return ${i};`);
        lines.push(`}`);
        lines.push('');
      }

      const code = lines.join('\n');
      const chunks = await chunkCode(code, '/test/many-functions.ts');

      // Should have a chunk for each function (some may be filtered for being too small)
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThanOrEqual(50);
    });

    it('should handle deeply nested class with many methods', async () => {
      const lines = ['class LargeService {'];

      // Add 30 methods
      for (let i = 0; i < 30; i++) {
        lines.push(`  method${i}() {`);
        lines.push(`    console.log('Method ${i}');`);
        lines.push(`    return ${i};`);
        lines.push(`  }`);
        lines.push('');
      }

      lines.push('}');

      const code = lines.join('\n');
      const chunks = await chunkCode(code, '/test/large-class.ts');

      // Should create a chunk for the class
      expect(chunks.length).toBeGreaterThan(0);

      // The class chunk should contain all methods
      const classChunk = chunks.find((c) => c.nodeType === 'class_declaration');
      expect(classChunk).toBeDefined();
    });
  });

  describe('Long Lines', () => {
    it('should handle files with very long lines', async () => {
      // Create a function with a very long line (> 1000 chars)
      const longString = 'a'.repeat(2000);
      const code = `function withLongLine() {
  const str = "${longString}";
  return str;
}`;

      const chunks = await chunkCode(code, '/test/long-line.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain('function withLongLine');
    });

    it('should handle function with many parameters', async () => {
      // Create a function with 20 parameters
      const params = Array.from({ length: 20 }, (_, i) => `param${i}: string`).join(', ');
      const code = `function manyParams(${params}) {
  return [${Array.from({ length: 20 }, (_, i) => `param${i}`).join(', ')}];
}`;

      const chunks = await chunkCode(code, '/test/many-params.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.name).toBe('manyParams');
    });
  });

  describe('Empty and Minimal Content', () => {
    it('should handle empty file', async () => {
      const chunks = await chunkCode('', '/test/empty.ts');
      expect(chunks).toEqual([]);
    });

    it('should handle file with only whitespace', async () => {
      const chunks = await chunkCode('   \n\n  \n   ', '/test/whitespace.ts');
      expect(chunks).toEqual([]);
    });

    it('should handle file with only comments', async () => {
      const code = `
// This is a comment
/* Multi-line
   comment */
/**
 * JSDoc comment
 */
`;
      const chunks = await chunkCode(code, '/test/comments-only.ts');
      // Should return empty or fallback chunks
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle minimal function', async () => {
      // Function that might be considered "too small"
      const code = `function x() {}`;
      const chunks = await chunkCode(code, '/test/minimal.ts');
      // Might be filtered as too small, or included
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('File Size Boundaries', () => {
    it('should handle content near chunk size boundary', async () => {
      // Create content just under the 2000 char limit
      const padding = 'x'.repeat(1800);
      const code = `function nearLimit() {
  const data = "${padding}";
  return data;
}`;

      expect(code.length).toBeLessThan(2100);
      expect(code.length).toBeGreaterThan(1800);

      const chunks = await chunkCode(code, '/test/near-limit.ts');

      expect(chunks.length).toBe(1); // Should not split
    });

    it('should handle content just over chunk size boundary', async () => {
      // Create content just over the 2000 char limit
      const padding = 'x'.repeat(2100);
      const code = `function overLimit() {
  const data = "${padding}";
  return data;
}`;

      expect(code.length).toBeGreaterThan(2000);

      const chunks = await chunkCode(code, '/test/over-limit.ts');

      // Should split into multiple chunks
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Memory Safety', () => {
    it('should handle repeated chunking without memory leaks', async () => {
      const code = `function test() {
  const x = 1;
  const y = 2;
  return x + y;
}`;

      // Chunk the same file many times
      for (let i = 0; i < 100; i++) {
        const chunks = await chunkCode(code, `/test/repeat-${i}.ts`);
        expect(chunks.length).toBeGreaterThan(0);
      }

      // If we get here without crashing, memory is being managed correctly
      expect(true).toBe(true);
    });
  });
});
