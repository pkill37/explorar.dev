// Debugging and logging utilities for GitHub API

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

class GitHubApiLogger {
  private logs: LogEntry[] = [];
  private metrics: PerformanceMetric[] = [];
  private maxLogs = 1000;
  private maxMetrics = 500;
  private enabled = false;

  constructor() {
    // Enable in development or if explicitly set
    if (typeof window !== 'undefined') {
      this.enabled =
        process.env.NODE_ENV === 'development' ||
        localStorage.getItem('github_api_debug') === 'true';
    }
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      context,
      error,
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Output to console based on level
    if (this.enabled || level === 'error' || level === 'warn') {
      const consoleMethod =
        level === 'error' ? 'error' : level === 'warn' ? 'warn' : level === 'info' ? 'info' : 'log';

      const prefix = `[GitHub API ${level.toUpperCase()}]`;
      if (error) {
        console[consoleMethod](prefix, message, context, error);
      } else if (context) {
        console[consoleMethod](prefix, message, context);
      } else {
        console[consoleMethod](prefix, message);
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  recordMetric(operation: string, duration: number, success: boolean, error?: string): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      success,
      error,
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    if (this.enabled) {
      const status = success ? '✓' : '✗';
      console.log(
        `[GitHub API Metric] ${status} ${operation}: ${duration.toFixed(2)}ms${error ? ` - ${error}` : ''}`
      );
    }
  }

  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filtered = level ? this.logs.filter((log) => log.level === level) : this.logs;
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    return filtered;
  }

  getMetrics(operation?: string, limit?: number): PerformanceMetric[] {
    let filtered = operation ? this.metrics.filter((m) => m.operation === operation) : this.metrics;
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    return filtered;
  }

  getStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    totalMetrics: number;
    averageDuration: number;
    successRate: number;
    recentErrors: number;
  } {
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    this.logs.forEach((log) => {
      logsByLevel[log.level]++;
    });

    const successfulMetrics = this.metrics.filter((m) => m.success);
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = this.metrics.length > 0 ? totalDuration / this.metrics.length : 0;
    const successRate =
      this.metrics.length > 0 ? successfulMetrics.length / this.metrics.length : 0;

    // Count errors in last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = this.logs.filter(
      (log) => log.level === 'error' && log.timestamp >= oneHourAgo
    ).length;

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      totalMetrics: this.metrics.length,
      averageDuration,
      successRate,
      recentErrors,
    };
  }

  clear(): void {
    this.logs = [];
    this.metrics = [];
    console.log('[GitHub API Logger] Logs and metrics cleared');
  }

  enable(): void {
    this.enabled = true;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('github_api_debug', 'true');
    }
    console.log('[GitHub API Logger] Debug mode enabled');
  }

  disable(): void {
    this.enabled = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('github_api_debug');
    }
    console.log('[GitHub API Logger] Debug mode disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Measure performance of an async operation
   */
  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.recordMetric(operation, duration, false, errorMessage);
      throw error;
    }
  }
}

// Singleton logger instance
export const logger = new GitHubApiLogger();
