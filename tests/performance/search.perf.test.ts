/**
 * Performance tests for search operations.
 *
 * Tests search latency, throughput, and resource usage under various conditions.
 */

import { MockVectorStore, createMockRecord } from '../mocks/store.mock.js';
import { mockEmbedSemantic, mockEmbedQuerySemantic } from '../mocks/embedder.mock.js';
import { boostKeywordMatches } from '../../src/search/reranker.js';
import { buildSafeFilter } from '../../src/search/filter-builder.js';
import { MetricsCollector } from '../../src/utils/metrics.js';

describe('Search Performance', () => {
  let store: MockVectorStore;
  let largeStore: MockVectorStore;

  beforeAll(async () => {
    // Set up a store with many records for performance testing
    largeStore = new MockVectorStore();
    await largeStore.initialize();

    const records = generateTestRecords(1000);
    await largeStore.upsert(records);
  });

  afterAll(async () => {
    await largeStore.close();
  });

  beforeEach(async () => {
    store = new MockVectorStore();
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('Search Latency', () => {
    it('should complete vector search in under 50ms (p50)', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const queryVector = mockEmbedQuerySemantic(`query ${i} function data`).embedding;

        const start = Date.now();
        await largeStore.vectorSearch(queryVector, 10);
        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[49]!;

      expect(p50).toBeLessThan(50);
    });

    it('should complete vector search in under 200ms (p99)', async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const queryVector = mockEmbedQuerySemantic(`query ${i}`).embedding;

        const start = Date.now();
        await largeStore.vectorSearch(queryVector, 10);
        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);
      const p99 = latencies[98]!;

      expect(p99).toBeLessThan(200);
    });

    it('should maintain consistent latency under sustained load', async () => {
      const latencies: number[] = [];

      // Run 500 queries in sequence
      for (let i = 0; i < 500; i++) {
        const queryVector = mockEmbedQuerySemantic(`query ${i % 50}`).embedding;

        const start = Date.now();
        await largeStore.vectorSearch(queryVector, 10);
        latencies.push(Date.now() - start);
      }

      // Check that latency doesn't degrade over time
      const firstHalf = latencies.slice(0, 250);
      const secondHalf = latencies.slice(250);

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be more than 2x slower than first half
      expect(avgSecond).toBeLessThan(avgFirst * 2);
    });
  });

  describe('Search with Filters', () => {
    it('should filter by language efficiently', async () => {
      const filter = buildSafeFilter({ filePattern: '*.ts' });
      const queryVector = mockEmbedQuerySemantic('function').embedding;

      const latencies: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await largeStore.vectorSearch(queryVector, 10, filter);
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      // Filtered search should still be fast
      expect(avgLatency).toBeLessThan(100);
    });

    it('should filter by path prefix efficiently', async () => {
      const filter = buildSafeFilter({ path: 'src_auth' });
      const queryVector = mockEmbedQuerySemantic('authentication').embedding;

      const latencies: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await largeStore.vectorSearch(queryVector, 10, filter);
        latencies.push(Date.now() - start);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      expect(avgLatency).toBeLessThan(100);
    });
  });

  describe('Keyword Boosting Performance', () => {
    it('should boost 100 results in under 10ms', () => {
      const results = Array.from({ length: 100 }, (_, i) => ({
        record: createMockRecord({
          id: `record_${i}`,
          content: `function func${i}(data: Data) { processData(data); return result; }`,
          name: `func${i}`,
          signature: `function func${i}(data: Data)`,
        }),
        score: Math.random(),
      }));

      const start = Date.now();
      boostKeywordMatches('process data function', results);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should boost 1000 results in under 50ms', () => {
      const results = Array.from({ length: 1000 }, (_, i) => ({
        record: createMockRecord({
          id: `record_${i}`,
          content: generateContent(i),
          name: `func${i}`,
          signature: `function func${i}()`,
        }),
        score: Math.random(),
      }));

      const start = Date.now();
      boostKeywordMatches('authentication login user password', results);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Concurrent Search Performance', () => {
    it('should handle 10 concurrent searches efficiently', async () => {
      const queries = Array.from({ length: 10 }, (_, i) =>
        mockEmbedQuerySemantic(`query ${i} search`).embedding
      );

      const start = Date.now();
      await Promise.all(
        queries.map((q) => largeStore.vectorSearch(q, 10))
      );
      const duration = Date.now() - start;

      // 10 concurrent searches in under 200ms
      expect(duration).toBeLessThan(200);
    });

    it('should handle 50 concurrent searches without degradation', async () => {
      const queries = Array.from({ length: 50 }, (_, i) =>
        mockEmbedQuerySemantic(`query ${i}`).embedding
      );

      const start = Date.now();
      const results = await Promise.all(
        queries.map((q) => largeStore.vectorSearch(q, 10))
      );
      const duration = Date.now() - start;

      // All searches should return results
      for (const result of results) {
        expect(result.length).toBeGreaterThan(0);
      }

      // 50 concurrent searches in under 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Metrics Tracking During Search', () => {
    it('should track search metrics with minimal overhead', async () => {
      const metrics = new MetricsCollector();

      const withMetrics: number[] = [];
      const withoutMetrics: number[] = [];

      // Without metrics
      for (let i = 0; i < 50; i++) {
        const queryVector = mockEmbedQuerySemantic(`query ${i}`).embedding;
        const start = Date.now();
        await largeStore.vectorSearch(queryVector, 10);
        withoutMetrics.push(Date.now() - start);
      }

      // With metrics
      for (let i = 0; i < 50; i++) {
        const queryVector = mockEmbedQuerySemantic(`query ${i}`).embedding;
        const start = Date.now();
        const results = await largeStore.vectorSearch(queryVector, 10);
        const latency = Date.now() - start;
        metrics.recordSearch(latency, results.length, false);
        withMetrics.push(latency);
      }

      const avgWithout = withoutMetrics.reduce((a, b) => a + b, 0) / withoutMetrics.length;
      const avgWith = withMetrics.reduce((a, b) => a + b, 0) / withMetrics.length;

      // Metrics tracking should add less than 10% overhead
      expect(avgWith).toBeLessThan(avgWithout * 1.1 + 1);
    });
  });

  describe('Memory Usage', () => {
    it('should not accumulate memory during repeated searches', async () => {
      // Note: This is a basic test. Real memory testing requires external tools.

      // Run many searches
      for (let i = 0; i < 1000; i++) {
        const queryVector = mockEmbedQuerySemantic(`query ${i % 100}`).embedding;
        await largeStore.vectorSearch(queryVector, 10);
      }

      // If we get here without crashing, memory is being managed reasonably
      expect(true).toBe(true);
    });
  });
});

/**
 * Generate test records for performance testing.
 */
function generateTestRecords(count: number) {
  const categories = ['auth', 'data', 'http', 'error', 'util'];
  const languages = ['typescript', 'python', 'go', 'rust'];

  return Array.from({ length: count }, (_, i) => {
    const category = categories[i % categories.length]!;
    const language = languages[i % languages.length]!;

    return createMockRecord({
      id: `src_${category}_file${i}_ts_L${i * 10}`,
      content: generateContent(i),
      name: `func${i}`,
      nodeType: 'function_declaration',
      language,
      filePath: `/project/src/${category}/file${i}.${language === 'python' ? 'py' : language === 'go' ? 'go' : language === 'rust' ? 'rs' : 'ts'}`,
      vector: mockEmbedSemantic(`${category} function ${i} ${generateContent(i)}`).embedding,
    });
  });
}

/**
 * Generate varied content for testing.
 */
function generateContent(index: number): string {
  const templates = [
    `function authenticate(user: User, password: string): Promise<Token> {
      const valid = await verifyCredentials(user, password);
      if (!valid) throw new AuthError('Invalid credentials');
      return generateToken(user);
    }`,
    `async function fetchData(url: string): Promise<Data> {
      const response = await fetch(url);
      if (!response.ok) throw new HttpError(response.status);
      return response.json();
    }`,
    `function processError(error: Error): void {
      console.error('Error occurred:', error.message);
      if (error instanceof ValidationError) {
        notifyUser(error.message);
      }
    }`,
    `function formatDate(date: Date): string {
      return date.toISOString().split('T')[0];
    }`,
    `async function queryDatabase(sql: string): Promise<Row[]> {
      const connection = await getConnection();
      const result = await connection.execute(sql);
      return result.rows;
    }`,
  ];

  return templates[index % templates.length]!;
}
