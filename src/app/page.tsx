'use client';

import { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { setGitHubRepo, getTrustedBranches } from '@/lib/github-api';
import type { GitHubTag } from '@/types';
import QuickStarts from '@/components/QuickStarts';

export default function Home() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<GitHubTag[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse GitHub URL from input
  const parsedRepo = useMemo(() => {
    if (!input.trim()) return null;
    const trimmed = input.trim();
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\s\.]+)/i,
      /^([^\/\s]+)\/([^\/\s\.]+)$/,
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\s\.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
        };
      }
    }
    return null;
  }, [input]);

  // Get trusted branches when a valid repo is detected
  useEffect(() => {
    if (!parsedRepo) return;

    // Get trusted branches directly (no API call needed)
    const trustedBranches = getTrustedBranches(parsedRepo.owner, parsedRepo.repo);
    
    if (trustedBranches.length > 0) {
      setBranches(trustedBranches);
      // Set default to first trusted branch
      setSelectedBranch(trustedBranches[0]?.name || '');
      setGitHubRepo(parsedRepo.owner, parsedRepo.repo, trustedBranches[0]?.name || '');
    } else {
      // No trusted versions configured for this repo
      setBranches([]);
      setSelectedBranch('');
    }
  }, [parsedRepo]);

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const repo = parsedRepo;
    if (!repo) {
      alert('Please enter a valid GitHub URL (e.g., github.com/owner/repo or owner/repo)');
      return;
    }

    setIsLoading(true);
    try {
      if (selectedBranch) {
        setGitHubRepo(repo.owner, repo.repo, selectedBranch);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kernel-explorer-github-url', `github.com/${repo.owner}/${repo.repo}`);
          localStorage.setItem('kernel-explorer-selected-version', selectedBranch);
        }
      }
      router.push(`/${repo.owner}/${repo.repo}`);
    } catch (error) {
      console.error('Failed to navigate:', error);
      alert('Failed to start explorer. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (url: string) => {
    setInput(url);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl mx-auto">
          {/* Welcome Message */}
          <header className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 sm:mb-4 px-2">
              Which repository would you like to learn?
            </h1>
            <p className="text-base sm:text-lg text-foreground/70 mb-2 px-2">
              Enter a GitHub repository URL to start exploring its codebase
            </p>
          </header>

          {/* Repository Input with QuickStarts */}
          <div className="max-w-2xl mx-auto">
            <section className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-foreground/5 border border-foreground/10 shadow-lg transition-all duration-300">
              <h2 className="text-lg font-semibold mb-4">Explore Repository</h2>
              
              <form onSubmit={handleSubmit} className="space-y-3 mb-4">
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="github.com/owner/repo"
                    className="flex-[0.7] px-4 py-2.5 rounded-lg border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="flex-[0.3] px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                        Starting...
                      </>
                    ) : (
                      <>
                        🚀 Start Exploring
                      </>
                    )}
                  </button>
                </div>

                {parsedRepo && branches.length > 0 && (
                  <div>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {branches.map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </form>

              {/* Compact QuickStarts */}
              <div className="pt-4">
                <QuickStarts onSelect={handleSuggestionClick} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
