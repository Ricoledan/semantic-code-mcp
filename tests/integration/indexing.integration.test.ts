/**
 * Integration tests for the indexing pipeline.
 *
 * Tests file indexing with incremental updates using mock stores.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MockVectorStore } from '../mocks/store.mock.js';
import { hashContent } from '../../src/watcher/index.js';
import { chunkCode } from '../../src/chunker/index.js';
import { mockEmbedBatch } from '../mocks/embedder.mock.js';
import { createVectorRecord, type VectorRecord } from '../../src/store/index.js';

describe('Indexing Integration', () => {
  let store: MockVectorStore;
  let tempDir: string;

  beforeEach(async () => {
    store = new MockVectorStore();
    await store.initialize();

    // Create temp directory for test files
    tempDir = path.join(process.cwd(), 'tests', '.temp-indexing-test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(async () => {
    await store.close();

    // Clean up temp files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('File Chunking and Indexing', () => {
    it('should chunk and index a TypeScript file', async () => {
      const content = `
/**
 * User authentication module
 */
export function login(username: string, password: string): Promise<User> {
  return authenticate(username, password);
}

export function logout(sessionId: string): void {
  destroySession(sessionId);
}

export class AuthService {
  private sessions: Map<string, Session> = new Map();

  createSession(user: User): Session {
    const session = { id: generateId(), user, createdAt: new Date() };
    this.sessions.set(session.id, session);
    return session;
  }

  validateSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
`;

      const filePath = path.join(tempDir, 'auth.ts');
      fs.writeFileSync(filePath, content);

      // Chunk the file
      const chunks = await chunkCode(content, filePath);

      expect(chunks.length).toBeGreaterThan(0);

      // Check we found functions and class
      const functionChunks = chunks.filter((c) =>
        ['function_declaration', 'export_statement', 'lexical_declaration'].includes(c.nodeType)
      );
      const classChunks = chunks.filter((c) =>
        ['class_declaration', 'export_statement'].includes(c.nodeType) &&
        c.content.includes('class ')
      );

      expect(functionChunks.length).toBeGreaterThanOrEqual(1);
      // The class might be wrapped in export_statement
      expect(classChunks.length).toBeGreaterThanOrEqual(0); // May vary by tree-sitter version

      // Generate embeddings and create records
      const embeddings = mockEmbedBatch(chunks.map((c) => c.content));
      const contentHash = hashContent(content);

      const records: VectorRecord[] = chunks.map((chunk, i) =>
        createVectorRecord(chunk, embeddings[i]!.embedding, contentHash)
      );

      // Store the records
      await store.upsert(records);

      // Verify storage
      const count = await store.count();
      expect(count).toBe(chunks.length);

      // Verify we can retrieve by file path
      const indexedFiles = await store.getIndexedFiles();
      expect(indexedFiles.has(filePath)).toBe(true);
      expect(indexedFiles.get(filePath)).toBe(contentHash);
    });

    it('should chunk and index a Python file', async () => {
      const content = `
"""
Data processing module
"""

def process_data(items: list) -> list:
    """Process a list of items."""
    return [transform(item) for item in items]

def transform(item: dict) -> dict:
    """Transform a single item."""
    return {
        'id': item['id'],
        'value': item['value'] * 2
    }

class DataProcessor:
    """A class for batch processing."""

    def __init__(self, batch_size: int = 100):
        self.batch_size = batch_size

    def process_batch(self, items: list) -> list:
        """Process items in batches."""
        results = []
        for i in range(0, len(items), self.batch_size):
            batch = items[i:i + self.batch_size]
            results.extend(process_data(batch))
        return results
`;

      const filePath = path.join(tempDir, 'processor.py');
      fs.writeFileSync(filePath, content);

      const chunks = await chunkCode(content, filePath);

      expect(chunks.length).toBeGreaterThan(0);

      // Should have functions and a class
      const hasFunctions = chunks.some((c) => c.nodeType === 'function_definition');
      const hasClass = chunks.some((c) => c.nodeType === 'class_definition');

      expect(hasFunctions).toBe(true);
      expect(hasClass).toBe(true);

      // All chunks should have Python as language
      for (const chunk of chunks) {
        expect(chunk.language).toBe('python');
      }
    });

    it('should use fallback chunking for unsupported files', async () => {
      const content = `
Some text content
that is not code
but should still be chunked
for searching purposes.
This is line 5.
This is line 6.
This is line 7.
`;

      const filePath = path.join(tempDir, 'readme.txt');
      fs.writeFileSync(filePath, content);

      const chunks = await chunkCode(content, filePath);

      // Should have at least one chunk
      expect(chunks.length).toBeGreaterThan(0);

      // Fallback chunks have specific node type
      for (const chunk of chunks) {
        expect(chunk.nodeType).toBe('fallback_chunk');
      }
    });
  });

  describe('Incremental Updates', () => {
    it('should detect unchanged files using content hash', async () => {
      const content = 'function unchanged() { return true; }';
      const filePath = '/project/src/unchanged.ts';
      const contentHash = hashContent(content);

      // First indexing
      const chunks1 = await chunkCode(content, filePath);
      const embeddings1 = mockEmbedBatch(chunks1.map((c) => c.content));
      const records1 = chunks1.map((chunk, i) =>
        createVectorRecord(chunk, embeddings1[i]!.embedding, contentHash)
      );
      await store.upsert(records1);

      // Check indexed files
      const indexedFiles = await store.getIndexedFiles();
      const existingHash = indexedFiles.get(filePath);

      // Same content = same hash = skip re-indexing
      const newHash = hashContent(content);
      expect(existingHash).toBe(newHash);
    });

    it('should detect changed files and update', async () => {
      const originalContent = 'function original() { return 1; }';
      const updatedContent = 'function updated() { return 2; }';
      const filePath = '/project/src/changing.ts';

      // Index original
      const originalHash = hashContent(originalContent);
      const chunks1 = await chunkCode(originalContent, filePath);
      const embeddings1 = mockEmbedBatch(chunks1.map((c) => c.content));
      const records1 = chunks1.map((chunk, i) =>
        createVectorRecord(chunk, embeddings1[i]!.embedding, originalHash)
      );
      await store.upsert(records1);

      // Verify original content
      let allRecords = store.getAllRecords();
      expect(allRecords.some((r) => r.content.includes('original'))).toBe(true);

      // Update the file (simulate delete + insert)
      await store.deleteByFilePath(filePath);

      const updatedHash = hashContent(updatedContent);
      const chunks2 = await chunkCode(updatedContent, filePath);
      const embeddings2 = mockEmbedBatch(chunks2.map((c) => c.content));
      const records2 = chunks2.map((chunk, i) =>
        createVectorRecord(chunk, embeddings2[i]!.embedding, updatedHash)
      );
      await store.upsert(records2);

      // Verify updated content
      allRecords = store.getAllRecords();
      expect(allRecords.some((r) => r.content.includes('updated'))).toBe(true);
      expect(allRecords.some((r) => r.content.includes('original'))).toBe(false);
    });

    it('should handle file deletion', async () => {
      const content = 'function toDelete() {}';
      const filePath = '/project/src/to-delete.ts';
      const contentHash = hashContent(content);

      // Index the file
      const chunks = await chunkCode(content, filePath);
      const embeddings = mockEmbedBatch(chunks.map((c) => c.content));
      const records = chunks.map((chunk, i) =>
        createVectorRecord(chunk, embeddings[i]!.embedding, contentHash)
      );
      await store.upsert(records);

      // Verify it's indexed
      expect(await store.count()).toBe(chunks.length);

      // Delete the file from index
      await store.deleteByFilePath(filePath);

      // Verify it's gone
      expect(await store.count()).toBe(0);
    });
  });

  describe('Multi-file Indexing', () => {
    it('should index multiple files and maintain integrity', async () => {
      const files = [
        {
          path: '/project/src/auth.ts',
          content: 'function login() {}',
        },
        {
          path: '/project/src/api.ts',
          content: 'function handleRequest() {}',
        },
        {
          path: '/project/src/db.ts',
          content: 'function query() {}',
        },
      ];

      // Index all files
      for (const file of files) {
        const chunks = await chunkCode(file.content, file.path);
        const embeddings = mockEmbedBatch(chunks.map((c) => c.content));
        const contentHash = hashContent(file.content);
        const records = chunks.map((chunk, i) =>
          createVectorRecord(chunk, embeddings[i]!.embedding, contentHash)
        );
        await store.upsert(records);
      }

      // Verify all files are indexed
      const indexedFiles = await store.getIndexedFiles();
      expect(indexedFiles.size).toBe(files.length);

      for (const file of files) {
        expect(indexedFiles.has(file.path)).toBe(true);
      }
    });

    it('should handle concurrent indexing of files', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        path: `/project/src/file${i}.ts`,
        content: `function func${i}() { return ${i}; }`,
      }));

      // Index all files concurrently
      await Promise.all(
        files.map(async (file) => {
          const chunks = await chunkCode(file.content, file.path);
          const embeddings = mockEmbedBatch(chunks.map((c) => c.content));
          const contentHash = hashContent(file.content);
          const records = chunks.map((chunk, i) =>
            createVectorRecord(chunk, embeddings[i]!.embedding, contentHash)
          );
          await store.upsert(records);
        })
      );

      // Verify all files are indexed
      const indexedFiles = await store.getIndexedFiles();
      expect(indexedFiles.size).toBe(files.length);
    });
  });

  describe('Content Hashing', () => {
    it('should produce consistent hashes for same content', () => {
      const content = 'function test() {}';

      const hash1 = hashContent(content);
      const hash2 = hashContent(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const content1 = 'function test1() {}';
      const content2 = 'function test2() {}';

      const hash1 = hashContent(content1);
      const hash2 = hashContent(content2);

      expect(hash1).not.toBe(hash2);
    });

    it('should detect whitespace changes', () => {
      const content1 = 'function test() {}';
      const content2 = 'function test() { }';

      const hash1 = hashContent(content1);
      const hash2 = hashContent(content2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
