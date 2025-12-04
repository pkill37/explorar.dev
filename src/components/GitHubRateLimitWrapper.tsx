'use client';

import React from 'react';
import { GitHubRateLimitProvider, useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';
import RateLimitScreen from '@/components/RateLimitScreen';
import { useGitHubRateLimitDetection } from '@/hooks/useGitHubRateLimit';

function RateLimitHandler({ children }: { children: React.ReactNode }) {
  const { rateLimitState } = useGitHubRateLimit();

  // Automatically detect rate limit errors
  useGitHubRateLimitDetection();

  return (
    <>
      {children}
      {rateLimitState.isRateLimited && <RateLimitScreen />}
    </>
  );
}

export default function GitHubRateLimitWrapper({ children }: { children: React.ReactNode }) {
  return (
    <GitHubRateLimitProvider>
      <RateLimitHandler>{children}</RateLimitHandler>
    </GitHubRateLimitProvider>
  );
}
