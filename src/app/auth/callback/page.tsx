'use client';

import { useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // The AuthContext will handle the callback
    // Just redirect to dashboard when authenticated
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    } else if (!isLoading && !isAuthenticated) {
      // If auth failed, redirect to home after a delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="text-center">
        {isLoading ? (
          <>
            <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Completing authentication...</p>
          </>
        ) : isAuthenticated ? (
          <>
            <p className="text-green-400 mb-4">✓ Authentication successful!</p>
            <p className="text-gray-400">Redirecting to dashboard...</p>
          </>
        ) : (
          <>
            <p className="text-red-400 mb-4">✗ Authentication failed</p>
            <p className="text-gray-400">Redirecting to home...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-950">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
