/**
 * Tests for the reranker functionality.
 */

import { boostKeywordMatches } from '../../src/search/reranker.js';
import { createMockRecord } from '../mocks/store.mock.js';
import type { SearchResult } from '../../src/store/index.js';

describe('Reranker', () => {
  describe('boostKeywordMatches', () => {
    it('should return empty array for empty input', () => {
      const result = boostKeywordMatches('test query', []);
      expect(result).toEqual([]);
    });

    it('should not modify scores when query is empty', () => {
      const results: SearchResult[] = [
        { record: createMockRecord({ id: '1' }), score: 0.5 },
        { record: createMockRecord({ id: '2' }), score: 0.3 },
      ];

      const boosted = boostKeywordMatches('', results);

      expect(boosted[0]!.score).toBe(0.5);
      expect(boosted[1]!.score).toBe(0.3);
    });

    it('should boost content matches', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'function handleError(error) { ... }',
            name: 'handleError',
          }),
          score: 0.5,
        },
      ];

      const boosted = boostKeywordMatches('error', results);

      expect(boosted[0]!.score).toBeGreaterThan(0.5);
    });

    it('should boost name matches more than content matches', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'some content',
            name: 'errorHandler',
            signature: 'function errorHandler()',
          }),
          score: 0.5,
        },
        {
          record: createMockRecord({
            id: '2',
            content: 'error handling code here',
            name: 'processData',
            signature: 'function processData()',
          }),
          score: 0.5,
        },
      ];

      const boosted = boostKeywordMatches('error', results);

      // First result has name match, should be boosted more
      expect(boosted[0]!.score).toBeGreaterThan(boosted[1]!.score);
    });

    it('should boost signature matches', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'content',
            name: 'func',
            signature: 'function func(userId: string)',
          }),
          score: 0.5,
        },
      ];

      const boosted = boostKeywordMatches('userId', results);

      expect(boosted[0]!.score).toBeGreaterThan(0.5);
    });

    it('should give highest weight to exact word matches in name', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'content',
            name: 'search',
            signature: 'function search()',
          }),
          score: 0.5,
        },
        {
          record: createMockRecord({
            id: '2',
            content: 'content',
            name: 'searchUsers',
            signature: 'function searchUsers()',
          }),
          score: 0.5,
        },
      ];

      const boosted = boostKeywordMatches('search', results);

      // Exact word match should get higher boost
      expect(boosted[0]!.score).toBeGreaterThan(boosted[1]!.score);
    });

    it('should handle multiple keywords', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'fetch user data',
            name: 'fetchUser',
            signature: 'function fetchUser()',
          }),
          score: 0.5,
        },
        {
          record: createMockRecord({
            id: '2',
            content: 'process data',
            name: 'processData',
            signature: 'function processData()',
          }),
          score: 0.5,
        },
      ];

      const boosted = boostKeywordMatches('fetch user', results);

      // First result matches both keywords
      expect(boosted[0]!.score).toBeGreaterThan(boosted[1]!.score);
    });

    it('should cap scores at 1.0', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'test test test test test',
            name: 'test',
            signature: 'test test',
          }),
          score: 0.99,
        },
      ];

      const boosted = boostKeywordMatches('test', results);

      expect(boosted[0]!.score).toBeLessThanOrEqual(1.0);
    });

    it('should handle case-insensitive matching', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'HandleError function',
            name: 'handleError',
          }),
          score: 0.5,
        },
      ];

      const boosted = boostKeywordMatches('HANDLEERROR', results);

      expect(boosted[0]!.score).toBeGreaterThan(0.5);
    });

    it('should handle null name and signature', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'test content',
            name: null,
            signature: null,
          }),
          score: 0.5,
        },
      ];

      // Should not throw
      const boosted = boostKeywordMatches('test', results);

      expect(boosted[0]!.score).toBeGreaterThan(0.5);
    });

    it('should preserve original record data', () => {
      const originalRecord = createMockRecord({
        id: 'original',
        content: 'test content',
        filePath: '/path/to/file.ts',
        startLine: 10,
        endLine: 20,
      });

      const results: SearchResult[] = [{ record: originalRecord, score: 0.5 }];

      const boosted = boostKeywordMatches('test', results);

      expect(boosted[0]!.record.id).toBe('original');
      expect(boosted[0]!.record.filePath).toBe('/path/to/file.ts');
      expect(boosted[0]!.record.startLine).toBe(10);
      expect(boosted[0]!.record.endLine).toBe(20);
    });

    it('should handle special regex characters in query', () => {
      const results: SearchResult[] = [
        {
          record: createMockRecord({
            id: '1',
            content: 'regex.test() function',
            name: 'testRegex',
          }),
          score: 0.5,
        },
      ];

      // Should not throw on regex special chars
      const boosted = boostKeywordMatches('regex.test', results);

      expect(boosted).toBeDefined();
    });
  });
});
