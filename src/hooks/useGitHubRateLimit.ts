import { useEffect } from 'react';
import { useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';

/**
 * Hook to automatically detect GitHub API rate limit errors from unhandled promise rejections
 * This provides a fallback for errors that aren't explicitly caught in components
 */
export function useGitHubRateLimitDetection() {
  const { checkRateLimit } = useGitHubRateLimit();

  useEffect(() => {
    // Listen for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      // Check if it's a rate limit error, but don't prevent default behavior
      // so other error handlers can still work
      checkRateLimit(error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [checkRateLimit]);
}

/**
 * Hook to wrap async functions and automatically detect rate limit errors
 */
export function useGitHubRateLimitWrapper<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  const { checkRateLimit } = useGitHubRateLimit();

  return ((...args: Parameters<T>) => {
    return fn(...args).catch((error: unknown) => {
      checkRateLimit(error);
      throw error; // Re-throw to maintain original behavior
    });
  }) as T;
}
