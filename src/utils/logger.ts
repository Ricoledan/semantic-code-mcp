/**
 * Structured logger for semantic-code-mcp.
 *
 * Provides consistent, component-based logging with support for JSON or text output.
 * All logs are written to stderr to avoid interfering with the MCP protocol on stdout.
 *
 * @example
 * ```typescript
 * import { logger, createLogger } from './utils/logger.js';
 *
 * // Use default logger
 * logger.info('search', 'Query received', { query: 'auth logic' });
 *
 * // Create component-specific logger
 * const log = createLogger('embedder');
 * log.debug('Loading model', { model: 'nomic-embed-text-v1.5' });
 * ```
 *
 * @module utils/logger
 */

/**
 * Log levels in order of severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Numeric values for log levels (used for filtering).
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Log entry structure for JSON output.
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** Minimum log level to output (default: 'info') */
  minLevel?: LogLevel;
  /** Output format: 'json' for structured logs, 'text' for human-readable (default: 'text') */
  format?: 'json' | 'text';
  /** Custom output function (default: console.error for MCP compatibility) */
  output?: (message: string) => void;
}

/**
 * Component-specific logger interface.
 */
export interface ComponentLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Main Logger class with structured logging capabilities.
 */
export class Logger {
  private minLevel: LogLevel;
  private format: 'json' | 'text';
  private output: (message: string) => void;

  constructor(options: LoggerOptions = {}) {
    // Read from environment with fallbacks
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
    const envFormat = process.env.LOG_FORMAT?.toLowerCase() as 'json' | 'text' | undefined;

    this.minLevel = options.minLevel ?? envLevel ?? 'info';
    this.format = options.format ?? envFormat ?? 'text';
    this.output = options.output ?? ((msg) => console.error(msg));
  }

  /**
   * Check if a log level should be output.
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[this.minLevel];
  }

  /**
   * Format a log entry for output.
   */
  private formatEntry(entry: LogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }

    // Text format: [TIMESTAMP] [LEVEL] [COMPONENT] message {data}
    const timestamp = entry.timestamp.split('T')[1]?.slice(0, 12) ?? entry.timestamp;
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';

    return `[${timestamp}] [${levelStr}] [${entry.component}] ${entry.message}${dataStr}`;
  }

  /**
   * Log a message at the specified level.
   */
  log(level: LogLevel, component: string, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      ...(data && { data }),
    };

    this.output(this.formatEntry(entry));
  }

  /**
   * Log a debug message.
   */
  debug(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', component, message, data);
  }

  /**
   * Log an info message.
   */
  info(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', component, message, data);
  }

  /**
   * Log a warning message.
   */
  warn(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', component, message, data);
  }

  /**
   * Log an error message.
   */
  error(component: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', component, message, data);
  }

  /**
   * Create a component-specific logger.
   */
  createLogger(component: string): ComponentLogger {
    return {
      debug: (message, data) => this.debug(component, message, data),
      info: (message, data) => this.info(component, message, data),
      warn: (message, data) => this.warn(component, message, data),
      error: (message, data) => this.error(component, message, data),
    };
  }

  /**
   * Update logger configuration at runtime.
   */
  configure(options: LoggerOptions): void {
    if (options.minLevel !== undefined) this.minLevel = options.minLevel;
    if (options.format !== undefined) this.format = options.format;
    if (options.output !== undefined) this.output = options.output;
  }
}

/**
 * Default logger instance.
 */
export const logger = new Logger();

/**
 * Create a component-specific logger.
 *
 * @param component - The component name for log prefixing
 * @returns A ComponentLogger bound to the specified component
 *
 * @example
 * ```typescript
 * const log = createLogger('search');
 * log.info('Search started', { query: 'auth logic' });
 * ```
 */
export function createLogger(component: string): ComponentLogger {
  return logger.createLogger(component);
}
