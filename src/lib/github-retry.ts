// Retry utility with exponential backoff and fault tolerance for GitHub API

import { GitHubApiError } from './github-api';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> & {
  onRetry?: RetryOptions['onRetry'];
} = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
  retryableErrors: ['NetworkError', 'TimeoutError', 'Failed to fetch'],
};

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'onRetry'>>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const delay = Math.min(exponentialDelay, options.maxDelay);

  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

/**
 * Check if an error is retryable
 */
function isRetryable(error: Error, options: Required<Omit<RetryOptions, 'onRetry'>>): boolean {
  // Check for GitHub API errors
  if (error instanceof GitHubApiError) {
    // Don't retry rate limits (403) - they need special handling
    if (error.status === 403) {
      return false;
    }

    // Retry on server errors and timeouts
    if (error.status && options.retryableStatuses.includes(error.status)) {
      return true;
    }
  }

  // Check error message for network errors
  const errorMessage = error.message || error.name || '';
  if (options.retryableErrors.some((retryable) => errorMessage.includes(retryable))) {
    return true;
  }

  // Check for network-related error types
  if (error.name === 'TypeError' && errorMessage.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts: Required<Omit<RetryOptions, 'onRetry'>> & { onRetry?: RetryOptions['onRetry'] } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (attempts = 0; attempts <= opts.maxRetries; attempts++) {
    try {
      const result = await fn();
      const totalTime = Date.now() - startTime;

      if (attempts > 0) {
        console.log(`[Retry] Success after ${attempts} retries in ${totalTime}ms`);
      }

      return {
        success: true,
        data: result,
        attempts: attempts + 1,
        totalTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if error is not retryable
      if (!isRetryable(lastError, opts)) {
        const totalTime = Date.now() - startTime;
        return {
          success: false,
          error: lastError,
          attempts: attempts + 1,
          totalTime,
        };
      }

      // If this was the last attempt, don't wait
      if (attempts >= opts.maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempts, opts);

      if (opts.onRetry) {
        opts.onRetry(attempts + 1, lastError);
      }

      console.warn(
        `[Retry] Attempt ${attempts + 1}/${opts.maxRetries} failed: ${lastError.message}. Retrying in ${Math.round(delay)}ms...`
      );

      await sleep(delay);
    }
  }

  const totalTime = Date.now() - startTime;
  console.error(`[Retry] All ${attempts} attempts failed after ${totalTime}ms`);

  return {
    success: false,
    error: lastError,
    attempts,
    totalTime,
  };
}

/**
 * Circuit breaker pattern for fault tolerance
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 60000, // 1 minute
    private readonly halfOpenMaxAttempts: number = 2
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'half-open';
        this.failures = 0;
        console.log('[CircuitBreaker] Transitioning to half-open state');
      } else {
        throw new Error('Circuit breaker is open - too many failures');
      }
    }

    try {
      const result = await fn();

      // Success - reset failure count
      if (this.state === 'half-open') {
        this.state = 'closed';
        console.log('[CircuitBreaker] Circuit breaker closed - service recovered');
      }

      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.state === 'half-open') {
        // If we fail in half-open, go back to open
        this.state = 'open';
        console.error('[CircuitBreaker] Circuit breaker opened again from half-open');
      } else if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        console.error(`[CircuitBreaker] Circuit breaker opened after ${this.failures} failures`);
      }

      throw error;
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
    console.log('[CircuitBreaker] Circuit breaker manually reset');
  }
}

// Global circuit breaker instance for GitHub API
export const githubCircuitBreaker = new CircuitBreaker(5, 60000);
