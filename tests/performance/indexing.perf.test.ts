/**
 * Performance tests for indexing operations.
 *
 * These tests verify that indexing performance meets baseline requirements.
 * Note: Actual performance will vary based on hardware and ML model loading.
 */

import { chunkCode, chunkFiles } from '../../src/chunker/index.js';
import { MockVectorStore, createMockRecord } from '../mocks/store.mock.js';
import { mockEmbedBatch } from '../mocks/embedder.mock.js';
import { createVectorRecord, type VectorRecord } from '../../src/store/index.js';
import { hashContent } from '../../src/watcher/index.js';
import { MetricsCollector } from '../../src/utils/metrics.js';

describe('Indexing Performance', () => {
  describe('Chunking Performance', () => {
    it('should chunk a typical file in under 100ms', async () => {
      const code = generateTypicalCode(100); // 100 lines

      const start = Date.now();
      await chunkCode(code, '/test/typical.ts');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should chunk a large file (1000 lines) in under 500ms', async () => {
      const code = generateTypicalCode(1000);

      const start = Date.now();
      await chunkCode(code, '/test/large.ts');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should chunk multiple files concurrently efficiently', async () => {
      const files = Array.from({ length: 50 }, (_, i) => ({
        path: `/test/file${i}.ts`,
        content: generateTypicalCode(50),
      }));

      const start = Date.now();
      const chunks = await chunkFiles(files);
      const duration = Date.now() - start;

      expect(chunks.length).toBeGreaterThan(0);
      // Should process 50 files in under 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Store Performance', () => {
    let store: MockVectorStore;

    beforeEach(async () => {
      store = new MockVectorStore();
      await store.initialize();
    });

    afterEach(async () => {
      await store.close();
    });

    it('should insert 1000 records in under 500ms', async () => {
      const records = Array.from({ length: 1000 }, (_, i) =>
        createMockRecord({
          id: `record_${i}`,
          content: `function func${i}() { return ${i}; }`,
        })
      );

      const start = Date.now();
      await store.upsert(records);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(await store.count()).toBe(1000);
    });

    it('should perform vector search on 1000 records in under 100ms', async () => {
      // Pre-populate store
      const records = Array.from({ length: 1000 }, (_, i) =>
        createMockRecord({
          id: `record_${i}`,
          content: `function func${i}() { return ${i}; }`,
          vector: generateRandomVector(768),
        })
      );
      await store.upsert(records);

      const queryVector = generateRandomVector(768);

      const start = Date.now();
      const results = await store.vectorSearch(queryVector, 10);
      const duration = Date.now() - start;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent searches efficiently', async () => {
      // Pre-populate store
      const records = Array.from({ length: 500 }, (_, i) =>
        createMockRecord({
          id: `record_${i}`,
          vector: generateRandomVector(768),
        })
      );
      await store.upsert(records);

      const searches = Array.from({ length: 20 }, () => ({
        vector: generateRandomVector(768),
      }));

      const start = Date.now();
      await Promise.all(
        searches.map((s) => store.vectorSearch(s.vector, 10))
      );
      const duration = Date.now() - start;

      // 20 concurrent searches in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Full Pipeline Performance', () => {
    it('should process and index 100 files with mock embeddings', async () => {
      const store = new MockVectorStore();
      await store.initialize();

      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `/project/src/file${i}.ts`,
        content: generateTypicalCode(30),
      }));

      const metrics = new MetricsCollector();
      const start = Date.now();

      for (const file of files) {
        const chunks = await chunkCode(file.content, file.path);
        const embeddings = mockEmbedBatch(chunks.map((c) => c.content));
        const contentHash = hashContent(file.content);

        const records: VectorRecord[] = chunks.map((chunk, i) =>
          createVectorRecord(chunk, embeddings[i]!.embedding, contentHash)
        );

        await store.upsert(records);
        metrics.recordIndexing(1, chunks.length, 0);
      }

      const duration = Date.now() - start;
      metrics.recordIndexing(0, 0, duration);

      await store.close();

      // 100 files in under 5 seconds with mock embeddings
      expect(duration).toBeLessThan(5000);

      const summary = metrics.getSummary();
      expect(summary.indexing.filesIndexed).toBe(100);
    });
  });

  describe('Metrics Tracking Performance', () => {
    it('should record metrics with minimal overhead', () => {
      const metrics = new MetricsCollector();

      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        metrics.recordSearch(Math.random() * 100, Math.floor(Math.random() * 20), false);
      }
      const duration = Date.now() - start;

      // 10000 metric recordings in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should compute summary efficiently', () => {
      const metrics = new MetricsCollector();

      // Record 1000 samples
      for (let i = 0; i < 1000; i++) {
        metrics.recordSearch(Math.random() * 100, Math.floor(Math.random() * 20), i % 10 === 0);
      }

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        metrics.getSummary();
      }
      const duration = Date.now() - start;

      // 100 summary computations in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});

/**
 * Generate typical TypeScript code for performance testing.
 */
function generateTypicalCode(lines: number): string {
  const parts: string[] = [];
  let currentLine = 0;

  while (currentLine < lines) {
    const funcLines = Math.min(Math.floor(Math.random() * 15) + 5, lines - currentLine);
    const funcName = `function${Math.floor(currentLine / 10)}`;

    parts.push(`function ${funcName}(param: string): string {`);
    currentLine++;

    for (let i = 0; i < funcLines - 2; i++) {
      parts.push(`  const var${i} = param + "${i}";`);
      currentLine++;
    }

    parts.push(`  return param;`);
    parts.push(`}`);
    parts.push('');
    currentLine += 2;
  }

  return parts.join('\n');
}

/**
 * Generate a random 768-dimensional vector for testing.
 */
function generateRandomVector(dimensions: number): number[] {
  const vector = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = Math.random() - 0.5;
  }

  // Normalize
  let magnitude = 0;
  for (const val of vector) {
    magnitude += val * val;
  }
  magnitude = Math.sqrt(magnitude);

  for (let i = 0; i < dimensions; i++) {
    vector[i] /= magnitude;
  }

  return vector;
}
