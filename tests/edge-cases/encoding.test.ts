/**
 * Edge case tests for character encoding handling.
 *
 * Tests BOM handling, Unicode characters, and various text encodings.
 */

import { chunkCode } from '../../src/chunker/index.js';
import { stripBOM } from '../../src/utils/paths.js';

describe('Encoding Edge Cases', () => {
  describe('BOM (Byte Order Mark) Handling', () => {
    it('should strip UTF-8 BOM from file content', () => {
      const withBOM = '\uFEFFfunction hello() {}';
      const stripped = stripBOM(withBOM);

      expect(stripped).toBe('function hello() {}');
      expect(stripped.charCodeAt(0)).not.toBe(0xfeff);
    });

    it('should not modify content without BOM', () => {
      const noBOM = 'function hello() {}';
      const result = stripBOM(noBOM);

      expect(result).toBe(noBOM);
    });

    it('should chunk code with UTF-8 BOM correctly', async () => {
      const codeWithBOM = '\uFEFFfunction withBOM() {\n  return "BOM stripped";\n}';

      const chunks = await chunkCode(codeWithBOM, '/test/bom.ts');

      expect(chunks.length).toBeGreaterThan(0);
      // The chunk content should not start with BOM
      expect(chunks[0]?.content.charCodeAt(0)).not.toBe(0xfeff);
    });

    it('should handle BOM in middle of file (should be preserved)', () => {
      const withMiddleBOM = 'start\uFEFFmiddle';
      const result = stripBOM(withMiddleBOM);

      // Only leading BOM should be stripped
      expect(result).toBe(withMiddleBOM);
    });
  });

  describe('Unicode Characters', () => {
    it('should handle Unicode function names', async () => {
      const code = `function grüßen() {
  return "Grüß Gott!";
}`;

      const chunks = await chunkCode(code, '/test/unicode-name.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain('grüßen');
    });

    it('should handle emoji in strings', async () => {
      const code = `function getEmoji() {
  return "Hello 👋 World 🌍";
}`;

      const chunks = await chunkCode(code, '/test/emoji.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain('👋');
      expect(chunks[0]?.content).toContain('🌍');
    });

    it('should handle emoji in comments', async () => {
      const code = `// This is a comment with emoji 🎉
function celebrate() {
  return true;
}`;

      const chunks = await chunkCode(code, '/test/emoji-comment.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle CJK characters', async () => {
      const code = `function 你好() {
  const 名前 = "世界";
  return \`你好, \${名前}!\`;
}`;

      const chunks = await chunkCode(code, '/test/cjk.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain('你好');
      expect(chunks[0]?.content).toContain('名前');
      expect(chunks[0]?.content).toContain('世界');
    });

    it('should handle Arabic and RTL text', async () => {
      const code = `function greet() {
  return "مرحبا بالعالم";
}`;

      const chunks = await chunkCode(code, '/test/arabic.ts');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toContain('مرحبا');
    });

    it('should handle mixed scripts', async () => {
      const code = `function mixedScripts() {
  const english = "Hello";
  const japanese = "こんにちは";
  const arabic = "مرحبا";
  const emoji = "👋";
  return \`\${english} \${japanese} \${arabic} \${emoji}\`;
}`;

      const chunks = await chunkCode(code, '/test/mixed-scripts.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle Unicode escape sequences', async () => {
      const code = `function escapes() {
  const heart = "\\u2764";
  const smiley = "\\u263A";
  return heart + smiley;
}`;

      const chunks = await chunkCode(code, '/test/escapes.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Special Characters', () => {
    it('should handle various quote styles', async () => {
      const code = `function quotes() {
  const single = 'single';
  const double = "double";
  const backtick = \`template\`;
  const smartQuotes = "smart" + 'quotes';
  return { single, double, backtick, smartQuotes };
}`;

      const chunks = await chunkCode(code, '/test/quotes.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle special whitespace characters', async () => {
      // Non-breaking space and other whitespace
      const code = `function whitespace() {
  const nbsp = "hello\u00A0world";
  const enSpace = "hello\u2002world";
  return nbsp + enSpace;
}`;

      const chunks = await chunkCode(code, '/test/whitespace.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle mathematical symbols', async () => {
      const code = `function math() {
  // π × r² = area
  const PI = 3.14159;
  const area = (r: number) => PI * r * r;
  return area;
}`;

      const chunks = await chunkCode(code, '/test/math.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Line Endings', () => {
    it('should handle Unix line endings (LF)', async () => {
      const code = 'function unix() {\n  return 1;\n}';

      const chunks = await chunkCode(code, '/test/unix.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle Windows line endings (CRLF)', async () => {
      const code = 'function windows() {\r\n  return 1;\r\n}';

      const chunks = await chunkCode(code, '/test/windows.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle old Mac line endings (CR)', async () => {
      const code = 'function oldMac() {\r  return 1;\r}';

      const chunks = await chunkCode(code, '/test/oldmac.ts');

      // Might fall back to line-based chunking
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle mixed line endings', async () => {
      const code = 'function mixed() {\n  const a = 1;\r\n  const b = 2;\r  return a + b;\n}';

      const chunks = await chunkCode(code, '/test/mixed-endings.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Python Encoding Declarations', () => {
    it('should handle Python encoding declaration', async () => {
      const code = `# -*- coding: utf-8 -*-

def hello():
    return "Hello, 世界!"`;

      const chunks = await chunkCode(code, '/test/encoding.py');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle Python with unicode strings', async () => {
      const code = `def unicode_strings():
    """A function with unicode: 日本語"""
    names = ["Alice", "Bölümü", "中文"]
    return names`;

      const chunks = await chunkCode(code, '/test/unicode.py');

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle string with only null character', async () => {
      const code = 'const x = "\0";';

      const chunks = await chunkCode(code, '/test/null.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle surrogate pairs', async () => {
      // Emoji that requires surrogate pairs
      const code = `function emoji() {
  return "🎉🎊🎁";  // These are surrogate pairs in JS
}`;

      const chunks = await chunkCode(code, '/test/surrogate.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle zero-width characters', async () => {
      const code = `function zeroWidth() {
  const zwj = "a\u200Bb";  // Zero-width joiner
  const zwnj = "c\u200Cd"; // Zero-width non-joiner
  return zwj + zwnj;
}`;

      const chunks = await chunkCode(code, '/test/zero-width.ts');

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
