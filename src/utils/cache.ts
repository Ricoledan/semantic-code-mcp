/**
 * LRU (Least Recently Used) cache implementation.
 * Provides efficient caching with automatic eviction of least recently used items.
 */

export interface LRUCacheOptions {
  /** Maximum number of items to store (default: 100) */
  maxSize?: number;
  /** Optional TTL in milliseconds for cache entries */
  ttlMs?: number;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * LRU Cache with optional TTL support.
 *
 * Uses a Map which maintains insertion order, enabling efficient LRU eviction.
 * When an item is accessed, it's moved to the end (most recently used position).
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<number>({ maxSize: 100, ttlMs: 60000 });
 * cache.set('key1', 42);
 * const value = cache.get('key1'); // 42
 * ```
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttlMs: number | undefined;

  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttlMs = options.ttlMs;
    this.cache = new Map();
  }

  /**
   * Get a value from the cache.
   * Moves the item to the most recently used position if found.
   *
   * @param key - The cache key
   * @returns The cached value or undefined if not found/expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check TTL if configured
    if (this.ttlMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > this.ttlMs) {
        this.cache.delete(key);
        return undefined;
      }
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache.
   * Evicts the least recently used item if at capacity.
   *
   * @param key - The cache key
   * @param value - The value to cache
   */
  set(key: string, value: T): void {
    // If key exists, delete it first to update its position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if a key exists in the cache (without updating its position).
   *
   * @param key - The cache key
   * @returns true if the key exists and hasn't expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check TTL if configured
    if (this.ttlMs !== undefined) {
      const age = Date.now() - entry.timestamp;
      if (age > this.ttlMs) {
        this.cache.delete(key);
        return false;
      }
    }

    return true;
  }

  /**
   * Remove a specific key from the cache.
   *
   * @param key - The cache key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of items in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): { size: number; maxSize: number; ttlMs: number | undefined } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}
