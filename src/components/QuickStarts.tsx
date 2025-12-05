'use client';

import React from 'react';

interface QuickStart {
  label: string;
  url: string;
  description?: string;
}

interface QuickStartsProps {
  onSelect: (url: string) => void;
  className?: string;
}

const QUICK_STARTS: QuickStart[] = [
  {
    label: 'torvalds/linux',
    url: 'github.com/torvalds/linux',
    description: 'Linux Kernel',
  },
  {
    label: 'python/cpython',
    url: 'github.com/python/cpython',
    description: 'CPython Interpreter',
  },
  {
    label: 'bminor/glibc',
    url: 'github.com/bminor/glibc',
    description: 'GNU C Library',
  },
  {
    label: 'llvm/llvm-project',
    url: 'github.com/llvm/llvm-project',
    description: 'LLVM Compiler Infrastructure',
  },
];

export default function QuickStarts({ onSelect, className = '' }: QuickStartsProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_STARTS.map((quickStart) => (
          <button
            key={quickStart.url}
            type="button"
            onClick={() => onSelect(quickStart.url)}
            className="group px-3 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 hover:border-foreground/20 transition-all text-left"
          >
            <div className="font-mono text-xs font-medium">{quickStart.label}</div>
            {quickStart.description && (
              <div className="text-xs text-foreground/50 mt-0.5">{quickStart.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
