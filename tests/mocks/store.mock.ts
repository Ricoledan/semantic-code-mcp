/**
 * Mock vector store for testing without LanceDB.
 */

import type { VectorRecord, SearchResult } from '../../src/store/index.js';

/**
 * In-memory mock vector store
 */
export class MockVectorStore {
  private records: Map<string, VectorRecord> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  async deleteByFilePath(filePath: string): Promise<void> {
    for (const [id, record] of this.records) {
      if (record.filePath === filePath) {
        this.records.delete(id);
      }
    }
  }

  async clear(): Promise<void> {
    this.records.clear();
  }

  async vectorSearch(
    queryVector: number[],
    limit: number = 50,
    filter?: string
  ): Promise<SearchResult[]> {
    // Simple cosine similarity search
    const results: Array<{ record: VectorRecord; score: number }> = [];

    for (const record of this.records.values()) {
      // Apply simple filter matching (just check if filter string matches)
      if (filter && !this.matchesFilter(record, filter)) {
        continue;
      }

      const score = this.cosineSimilarity(queryVector, record.vector);
      results.push({ record, score });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  async count(): Promise<number> {
    return this.records.size;
  }

  async getIndexedFiles(): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    for (const record of this.records.values()) {
      if (!files.has(record.filePath)) {
        files.set(record.filePath, record.contentHash);
      }
    }
    return files;
  }

  async isEmpty(): Promise<boolean> {
    return this.records.size === 0;
  }

  async close(): Promise<void> {
    this.records.clear();
    this.initialized = false;
  }

  // Helper to add test data directly
  addRecord(record: VectorRecord): void {
    this.records.set(record.id, record);
  }

  // Helper to get all records for assertions
  getAllRecords(): VectorRecord[] {
    return Array.from(this.records.values());
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  private matchesFilter(record: VectorRecord, filter: string): boolean {
    // Simple filter matching for testing
    if (filter.includes('language =')) {
      const langMatch = filter.match(/language = '(\w+)'/);
      if (langMatch && langMatch[1]) {
        return record.language === langMatch[1];
      }
    }
    if (filter.includes('id LIKE')) {
      const likeMatch = filter.match(/id LIKE '([^']+)'/);
      if (likeMatch && likeMatch[1]) {
        const pattern = likeMatch[1].replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(pattern).test(record.id);
      }
    }
    return true;
  }
}

/**
 * Create a mock vector record for testing
 */
export function createMockRecord(overrides: Partial<VectorRecord> = {}): VectorRecord {
  const defaults: VectorRecord = {
    id: 'test_file_ts_L1',
    vector: new Array(768).fill(0.1),
    filePath: '/test/file.ts',
    content: 'function test() { return true; }',
    startLine: 1,
    endLine: 3,
    name: 'test',
    nodeType: 'function_declaration',
    signature: 'function test()',
    docstring: null,
    language: 'typescript',
    contentHash: 'abc123',
    indexedAt: Date.now(),
  };

  return { ...defaults, ...overrides };
}
