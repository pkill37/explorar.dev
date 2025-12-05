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
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Quick Start</h3>
        <p className="text-sm text-foreground/70 mb-4">
          Jump into exploring popular open-source projects
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {QUICK_STARTS.map((quickStart) => (
          <button
            key={quickStart.url}
            type="button"
            onClick={() => onSelect(quickStart.url)}
            className="group px-4 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 hover:border-foreground/20 transition-all text-left"
          >
            <div className="font-mono text-sm font-medium mb-1">{quickStart.label}</div>
            {quickStart.description && (
              <div className="text-xs text-foreground/60">{quickStart.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
