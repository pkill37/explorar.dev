'use client';

import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md mx-auto">
          <div className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10 shadow-lg transition-all duration-300">
            <div className="flex flex-col items-center gap-6">
              {/* Spinner */}
              <div className="relative">
                <div className="w-16 h-16 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin"></div>
              </div>

              {/* Loading Text */}
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Loading Repository</h2>
                <p className="text-sm text-foreground/70">Preparing your learning experience...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
