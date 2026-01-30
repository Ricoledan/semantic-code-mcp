/**
 * Metrics collector for semantic-code-mcp.
 *
 * Tracks indexing and search performance metrics for observability.
 *
 * @example
 * ```typescript
 * import { metrics } from './utils/metrics.js';
 *
 * // Record indexing metrics
 * metrics.recordIndexing(10, 50, 1500);
 *
 * // Record search metrics
 * const start = Date.now();
 * // ... perform search ...
 * metrics.recordSearch(Date.now() - start, 10, false);
 *
 * // Get summary
 * const summary = metrics.getSummary();
 * console.log(summary);
 * ```
 *
 * @module utils/metrics
 */

/**
 * Indexing metrics tracked over time.
 */
export interface IndexingMetrics {
  /** Total files indexed */
  filesIndexed: number;
  /** Total chunks created */
  chunksCreated: number;
  /** Total embeddings generated */
  embeddingsGenerated: number;
  /** Total indexing duration in milliseconds */
  indexDurationMs: number;
  /** Number of indexing errors */
  errorsCount: number;
}

/**
 * Search metrics tracked over time.
 */
export interface SearchMetrics {
  /** Total number of queries */
  queriesTotal: number;
  /** Query latency samples in milliseconds */
  queryLatencyMs: number[];
  /** Results returned per query */
  resultsReturned: number[];
  /** Number of fallbacks to keyword search triggered */
  fallbacksTriggered: number;
  /** Number of search errors */
  errorsCount: number;
}

/**
 * Computed summary statistics.
 */
export interface MetricsSummary {
  indexing: {
    filesIndexed: number;
    chunksCreated: number;
    embeddingsGenerated: number;
    totalDurationMs: number;
    errorsCount: number;
  };
  search: {
    queriesTotal: number;
    latencyP50Ms: number;
    latencyP99Ms: number;
    avgResults: number;
    fallbackRate: number;
    errorRate: number;
  };
}

/**
 * Calculate a percentile from a sorted array.
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}

/**
 * Calculate the average of an array.
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Metrics collector class.
 */
export class MetricsCollector {
  private indexing: IndexingMetrics = {
    filesIndexed: 0,
    chunksCreated: 0,
    embeddingsGenerated: 0,
    indexDurationMs: 0,
    errorsCount: 0,
  };

  private search: SearchMetrics = {
    queriesTotal: 0,
    queryLatencyMs: [],
    resultsReturned: [],
    fallbacksTriggered: 0,
    errorsCount: 0,
  };

  /** Maximum number of latency samples to keep (circular buffer) */
  private maxSamples = 1000;

  /**
   * Record indexing operation metrics.
   *
   * @param filesIndexed - Number of files indexed in this operation
   * @param chunksCreated - Number of chunks created
   * @param durationMs - Duration of the indexing operation in milliseconds
   * @param embeddingsGenerated - Number of embeddings generated (defaults to chunksCreated)
   */
  recordIndexing(
    filesIndexed: number,
    chunksCreated: number,
    durationMs: number,
    embeddingsGenerated?: number
  ): void {
    this.indexing.filesIndexed += filesIndexed;
    this.indexing.chunksCreated += chunksCreated;
    this.indexing.embeddingsGenerated += embeddingsGenerated ?? chunksCreated;
    this.indexing.indexDurationMs += durationMs;
  }

  /**
   * Record an indexing error.
   *
   * @param count - Number of errors to record (default: 1)
   */
  recordIndexingError(count: number = 1): void {
    this.indexing.errorsCount += count;
  }

  /**
   * Record search operation metrics.
   *
   * @param latencyMs - Query latency in milliseconds
   * @param resultsCount - Number of results returned
   * @param usedFallback - Whether keyword fallback was used
   */
  recordSearch(latencyMs: number, resultsCount: number, usedFallback: boolean = false): void {
    this.search.queriesTotal += 1;

    // Circular buffer for latency samples
    this.search.queryLatencyMs.push(latencyMs);
    if (this.search.queryLatencyMs.length > this.maxSamples) {
      this.search.queryLatencyMs.shift();
    }

    // Circular buffer for results samples
    this.search.resultsReturned.push(resultsCount);
    if (this.search.resultsReturned.length > this.maxSamples) {
      this.search.resultsReturned.shift();
    }

    if (usedFallback) {
      this.search.fallbacksTriggered += 1;
    }
  }

  /**
   * Record a search error.
   *
   * @param count - Number of errors to record (default: 1)
   */
  recordSearchError(count: number = 1): void {
    this.search.errorsCount += count;
  }

  /**
   * Get the current metrics summary.
   *
   * @returns Computed summary with percentiles and averages
   */
  getSummary(): MetricsSummary {
    const sortedLatencies = [...this.search.queryLatencyMs].sort((a, b) => a - b);

    return {
      indexing: {
        filesIndexed: this.indexing.filesIndexed,
        chunksCreated: this.indexing.chunksCreated,
        embeddingsGenerated: this.indexing.embeddingsGenerated,
        totalDurationMs: this.indexing.indexDurationMs,
        errorsCount: this.indexing.errorsCount,
      },
      search: {
        queriesTotal: this.search.queriesTotal,
        latencyP50Ms: percentile(sortedLatencies, 50),
        latencyP99Ms: percentile(sortedLatencies, 99),
        avgResults: average(this.search.resultsReturned),
        fallbackRate:
          this.search.queriesTotal > 0
            ? this.search.fallbacksTriggered / this.search.queriesTotal
            : 0,
        errorRate:
          this.search.queriesTotal > 0
            ? this.search.errorsCount / this.search.queriesTotal
            : 0,
      },
    };
  }

  /**
   * Get raw indexing metrics.
   */
  getIndexingMetrics(): IndexingMetrics {
    return { ...this.indexing };
  }

  /**
   * Get raw search metrics.
   */
  getSearchMetrics(): SearchMetrics {
    return {
      ...this.search,
      queryLatencyMs: [...this.search.queryLatencyMs],
      resultsReturned: [...this.search.resultsReturned],
    };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.indexing = {
      filesIndexed: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      indexDurationMs: 0,
      errorsCount: 0,
    };
    this.search = {
      queriesTotal: 0,
      queryLatencyMs: [],
      resultsReturned: [],
      fallbacksTriggered: 0,
      errorsCount: 0,
    };
  }
}

/**
 * Default metrics collector instance.
 */
export const metrics = new MetricsCollector();
