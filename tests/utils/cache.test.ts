/**
 * Tests for the LRU cache utility.
 */

import { LRUCache } from '../../src/utils/cache.js';

describe('LRUCache', () => {
  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache<number>();
      cache.set('key1', 42);
      expect(cache.get('key1')).toBe(42);
    });

    it('should return undefined for missing keys', () => {
      const cache = new LRUCache<number>();
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing values', () => {
      const cache = new LRUCache<number>();
      cache.set('key1', 42);
      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should report correct size', () => {
      const cache = new LRUCache<number>();
      expect(cache.size).toBe(0);
      cache.set('key1', 1);
      expect(cache.size).toBe(1);
      cache.set('key2', 2);
      expect(cache.size).toBe(2);
    });

    it('should check if key exists with has()', () => {
      const cache = new LRUCache<number>();
      cache.set('key1', 42);
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete specific keys', () => {
      const cache = new LRUCache<number>();
      cache.set('key1', 42);
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<number>();
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const cache = new LRUCache<number>({ maxSize: 3 });
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);
      cache.set('key4', 4); // Should evict key1

      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(2);
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });

    it('should update position on get()', () => {
      const cache = new LRUCache<number>({ maxSize: 3 });
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      // Access key1, making it most recently used
      cache.get('key1');

      // Add key4, should evict key2 (now oldest)
      cache.set('key4', 4);

      expect(cache.get('key1')).toBe(1);
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe(3);
      expect(cache.get('key4')).toBe(4);
    });

    it('should update position on set() for existing key', () => {
      const cache = new LRUCache<number>({ maxSize: 3 });
      cache.set('key1', 1);
      cache.set('key2', 2);
      cache.set('key3', 3);

      // Update key1, making it most recently used
      cache.set('key1', 100);

      // Add key4, should evict key2 (now oldest)
      cache.set('key4', 4);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL support', () => {
    it('should expire entries after TTL', async () => {
      const cache = new LRUCache<number>({ ttlMs: 50 });
      cache.set('key1', 42);

      expect(cache.get('key1')).toBe(42);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not return expired entries with has()', async () => {
      const cache = new LRUCache<number>({ ttlMs: 50 });
      cache.set('key1', 42);

      expect(cache.has('key1')).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.has('key1')).toBe(false);
    });

    it('should keep non-expired entries', async () => {
      const cache = new LRUCache<number>({ ttlMs: 100 });
      cache.set('key1', 42);

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(cache.get('key1')).toBe(42);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const cache = new LRUCache<number>({ maxSize: 50, ttlMs: 1000 });
      cache.set('key1', 1);
      cache.set('key2', 2);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(50);
      expect(stats.ttlMs).toBe(1000);
    });

    it('should return undefined ttlMs when not configured', () => {
      const cache = new LRUCache<number>({ maxSize: 100 });
      const stats = cache.getStats();
      expect(stats.ttlMs).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle maxSize of 1', () => {
      const cache = new LRUCache<number>({ maxSize: 1 });
      cache.set('key1', 1);
      cache.set('key2', 2);

      expect(cache.size).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(2);
    });

    it('should handle empty strings as keys', () => {
      const cache = new LRUCache<number>();
      cache.set('', 42);
      expect(cache.get('')).toBe(42);
    });

    it('should handle various value types', () => {
      const stringCache = new LRUCache<string>();
      stringCache.set('key', 'hello');
      expect(stringCache.get('key')).toBe('hello');

      const arrayCache = new LRUCache<number[]>();
      arrayCache.set('key', [1, 2, 3]);
      expect(arrayCache.get('key')).toEqual([1, 2, 3]);

      const objectCache = new LRUCache<{ name: string }>();
      objectCache.set('key', { name: 'test' });
      expect(objectCache.get('key')).toEqual({ name: 'test' });
    });

    it('should use default maxSize of 100', () => {
      const cache = new LRUCache<number>();
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(100);
    });
  });
});
