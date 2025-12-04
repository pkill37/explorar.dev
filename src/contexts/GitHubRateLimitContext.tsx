'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { GitHubApiError } from '@/lib/github-api';

interface RateLimitState {
  isRateLimited: boolean;
  resetTime: Date | null;
  errorMessage: string | null;
}

interface GitHubRateLimitContextType {
  rateLimitState: RateLimitState;
  setRateLimit: (error: GitHubApiError) => void;
  clearRateLimit: () => void;
  checkRateLimit: (error: unknown) => boolean;
}

const GitHubRateLimitContext = createContext<GitHubRateLimitContextType | undefined>(undefined);

export function GitHubRateLimitProvider({ children }: { children: ReactNode }) {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    resetTime: null,
    errorMessage: null,
  });

  const checkRateLimit = useCallback((error: unknown): boolean => {
    if (error instanceof GitHubApiError && error.status === 403) {
      // Check if error message contains rate limit info
      const message = error.message;
      if (message.includes('rate limit exceeded') || message.includes('rate limit')) {
        // Extract reset time from error message
        // Format: "GitHub API rate limit exceeded. Resets at 12/4/2025, 11:04:59 PM"
        const resetMatch = message.match(/Resets at (.+)/);
        let resetTime: Date | null = null;

        if (resetMatch) {
          try {
            resetTime = new Date(resetMatch[1]);
            // Validate the date
            if (isNaN(resetTime.getTime())) {
              resetTime = null;
            }
          } catch {
            resetTime = null;
          }
        }

        setRateLimitState({
          isRateLimited: true,
          resetTime,
          errorMessage: message,
        });

        return true;
      }
    }
    return false;
  }, []);

  const setRateLimit = useCallback(
    (error: GitHubApiError) => {
      checkRateLimit(error);
    },
    [checkRateLimit]
  );

  const clearRateLimit = useCallback(() => {
    setRateLimitState({
      isRateLimited: false,
      resetTime: null,
      errorMessage: null,
    });
  }, []);

  // Check if rate limit has expired
  React.useEffect(() => {
    if (rateLimitState.isRateLimited && rateLimitState.resetTime) {
      const now = new Date();
      const resetTime = rateLimitState.resetTime;

      if (now >= resetTime) {
        // Rate limit has expired, clear it
        clearRateLimit();
      } else {
        // Set up a timer to clear when it expires
        const timeUntilReset = resetTime.getTime() - now.getTime();
        const timer = setTimeout(() => {
          clearRateLimit();
        }, timeUntilReset);

        return () => clearTimeout(timer);
      }
    }
  }, [rateLimitState.isRateLimited, rateLimitState.resetTime, clearRateLimit]);

  return (
    <GitHubRateLimitContext.Provider
      value={{
        rateLimitState,
        setRateLimit,
        clearRateLimit,
        checkRateLimit,
      }}
    >
      {children}
    </GitHubRateLimitContext.Provider>
  );
}

export function useGitHubRateLimit() {
  const context = useContext(GitHubRateLimitContext);
  if (context === undefined) {
    throw new Error('useGitHubRateLimit must be used within a GitHubRateLimitProvider');
  }
  return context;
}
