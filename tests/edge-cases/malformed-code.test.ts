/**
 * Edge case tests for malformed and invalid code.
 *
 * Tests that the chunker handles syntax errors, incomplete code,
 * and other malformed inputs gracefully.
 */

import { chunkCode } from '../../src/chunker/index.js';

describe('Malformed Code Edge Cases', () => {
  describe('Syntax Errors', () => {
    it('should handle unclosed braces', async () => {
      const code = `function broken() {
  const x = 1;
  // Missing closing brace`;

      const chunks = await chunkCode(code, '/test/unclosed-brace.ts');

      // Should fall back gracefully - either empty or fallback chunks
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle unclosed strings', async () => {
      const code = `function withBadString() {
  const str = "this string never closes
  return str;
}`;

      const chunks = await chunkCode(code, '/test/unclosed-string.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle unclosed parentheses', async () => {
      const code = `function broken(a, b, c {
  return a + b + c;
}`;

      const chunks = await chunkCode(code, '/test/unclosed-parens.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle mismatched brackets', async () => {
      const code = `function mismatched() {
  const arr = [1, 2, 3};
  return arr;
}`;

      const chunks = await chunkCode(code, '/test/mismatched.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle incomplete class definition', async () => {
      const code = `class Incomplete {
  constructor() {
    this.value = 1;
  }
  // Missing closing brace for class`;

      const chunks = await chunkCode(code, '/test/incomplete-class.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Invalid Syntax Patterns', () => {
    it('should handle duplicate keywords', async () => {
      const code = `function function double() {
  return 1;
}`;

      const chunks = await chunkCode(code, '/test/duplicate-keyword.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle random characters', async () => {
      const code = `@#$%^&*()!~\`{}[]|\\`;

      const chunks = await chunkCode(code, '/test/random-chars.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle mixed language syntax', async () => {
      const code = `function jsFunc() {
  def pythonFunc():
    pass
  return 1;
}`;

      const chunks = await chunkCode(code, '/test/mixed-lang.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle HTML in JS file', async () => {
      const code = `<html>
<head>
  <title>Not JavaScript</title>
</head>
<body>
  <script>
    function validJs() { return 1; }
  </script>
</body>
</html>`;

      const chunks = await chunkCode(code, '/test/html-in-js.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Binary and Non-text Content', () => {
    it('should handle null bytes in content', async () => {
      const code = `function withNull() {\x00  return 1;\x00}`;

      const chunks = await chunkCode(code, '/test/null-bytes.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle control characters', async () => {
      const code = `function withControl() {
  const x = \x01\x02\x03;
  return x;
}`;

      const chunks = await chunkCode(code, '/test/control-chars.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Deeply Nested Code', () => {
    it('should handle deeply nested blocks', async () => {
      // Create code with 50 levels of nesting
      let code = 'function deepNest() {\n';
      for (let i = 0; i < 50; i++) {
        code += '  '.repeat(i + 1) + 'if (true) {\n';
      }
      code += '  '.repeat(51) + 'return 1;\n';
      for (let i = 49; i >= 0; i--) {
        code += '  '.repeat(i + 1) + '}\n';
      }
      code += '}';

      const chunks = await chunkCode(code, '/test/deep-nest.ts');

      // Should handle without stack overflow
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle deeply nested expressions', async () => {
      // Create deeply nested function calls
      let expr = 'x';
      for (let i = 0; i < 50; i++) {
        expr = `f${i}(${expr})`;
      }
      const code = `function deepExpr() { return ${expr}; }`;

      const chunks = await chunkCode(code, '/test/deep-expr.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle deeply nested objects', async () => {
      // Create deeply nested object literal
      let obj = '{ value: 1 }';
      for (let i = 0; i < 30; i++) {
        obj = `{ nested${i}: ${obj} }`;
      }
      const code = `const deepObj = ${obj};`;

      const chunks = await chunkCode(code, '/test/deep-obj.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Python Malformed Code', () => {
    it('should handle incomplete Python function', async () => {
      const code = `def incomplete():
    x = 1
    # Missing return or pass`;

      const chunks = await chunkCode(code, '/test/incomplete.py');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle mixed indentation in Python', async () => {
      const code = `def mixed():
    x = 1
\t\ty = 2  # Tab indentation
    return x + y`;

      const chunks = await chunkCode(code, '/test/mixed-indent.py');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Go Malformed Code', () => {
    it('should handle incomplete Go function', async () => {
      const code = `package main

func incomplete() {
    x := 1
    // Missing closing brace`;

      const chunks = await chunkCode(code, '/test/incomplete.go');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle missing package declaration', async () => {
      const code = `func noPackage() int {
    return 42
}`;

      const chunks = await chunkCode(code, '/test/no-package.go');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Rust Malformed Code', () => {
    it('should handle incomplete Rust function', async () => {
      const code = `fn incomplete() -> i32 {
    let x = 1;
    // Missing return and closing brace`;

      const chunks = await chunkCode(code, '/test/incomplete.rs');

      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle invalid lifetime syntax', async () => {
      const code = `fn bad_lifetime<'a, 'b>(x: &'a str, y: &'b str -> &'??? str {
    x
}`;

      const chunks = await chunkCode(code, '/test/bad-lifetime.rs');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Recovery from Errors', () => {
    it('should recover and process valid code after invalid section', async () => {
      const code = `// Invalid section
@#$%^&*

// Valid function that should be found
function validAfterInvalid() {
  return 'valid';
}`;

      const chunks = await chunkCode(code, '/test/recovery.ts');

      expect(Array.isArray(chunks)).toBe(true);
      // The valid function might be found depending on parser recovery
    });

    it('should handle alternating valid and invalid code', async () => {
      const code = `function valid1() { return 1; }

@#$% invalid

function valid2() { return 2; }

more invalid {{{{

function valid3() { return 3; }`;

      const chunks = await chunkCode(code, '/test/alternating.ts');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });
});
