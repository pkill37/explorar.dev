'use client';

import { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { setGitHubRepo, fetchKernelVersions } from '@/lib/github-api';
import type { GitHubTag } from '@/types';

export default function Home() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branches, setBranches] = useState<GitHubTag[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('master');
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string } | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse GitHub URL from input (for display purposes)
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

  // Auto-fetch branches when a valid repo is detected
  useEffect(() => {
    if (!parsedRepo || isLoadingBranches) return;

    // Only fetch if we don't already have this repo loaded
    if (repoInfo && repoInfo.owner === parsedRepo.owner && repoInfo.repo === parsedRepo.repo) {
      return;
    }

    const fetchBranches = async () => {
      setIsLoadingBranches(true);
      try {
        setGitHubRepo(parsedRepo.owner, parsedRepo.repo, 'master');
        const fetchedBranches = await fetchKernelVersions();
        setBranches(fetchedBranches);
        setRepoInfo(parsedRepo);
        setSelectedBranch('master');
      } catch (error) {
        console.error('Failed to fetch branches:', error);
        // Don't show alert on auto-fetch, just log
      } finally {
        setIsLoadingBranches(false);
      }
    };

    // Debounce the fetch
    const timer = setTimeout(fetchBranches, 500);
    return () => clearTimeout(timer);
  }, [parsedRepo, repoInfo, isLoadingBranches]);

  const handleUrlSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isLoadingBranches) return;

    if (!parsedRepo) {
      alert('Please enter a valid GitHub URL (e.g., github.com/owner/repo or owner/repo)');
      return;
    }

    // If branches are already loaded for this repo, just proceed
    if (repoInfo && repoInfo.owner === parsedRepo.owner && repoInfo.repo === parsedRepo.repo) {
      return;
    }

    // Trigger manual fetch if auto-fetch hasn't completed yet
    if (!repoInfo || repoInfo.owner !== parsedRepo.owner || repoInfo.repo !== parsedRepo.repo) {
      setIsLoadingBranches(true);
      try {
        setGitHubRepo(parsedRepo.owner, parsedRepo.repo, 'master');
        const fetchedBranches = await fetchKernelVersions();
        setBranches(fetchedBranches);
        setRepoInfo(parsedRepo);
        setSelectedBranch('master');
      } catch (error) {
        console.error('Failed to fetch branches:', error);
        alert(
          error instanceof Error
            ? `Failed to fetch branches: ${error.message}`
            : 'Failed to fetch branches. Please check the repository URL.'
        );
      } finally {
        setIsLoadingBranches(false);
      }
    }
  };

  const handleStartExplorer = () => {
    if (!repoInfo || isLoading) return;

    setIsLoading(true);
    try {
      // Set the repo with selected branch
      setGitHubRepo(repoInfo.owner, repoInfo.repo, selectedBranch);

      // Store in localStorage for the explorer page
      if (typeof window !== 'undefined') {
        const githubUrl = `github.com/${repoInfo.owner}/${repoInfo.repo}`;
        localStorage.setItem('kernel-explorer-github-url', githubUrl);
        localStorage.setItem('kernel-explorer-selected-version', selectedBranch);
      }

      // Navigate to explorer using the new dynamic route
      // Format: /owner/repo
      router.push(`/${repoInfo.owner}/${repoInfo.repo}`);
    } catch (error) {
      console.error('Failed to start explorer:', error);
      alert('Failed to start explorer. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (url: string) => {
    setInput(url);
    // Use setTimeout to ensure state is updated before submit
    setTimeout(() => {
      handleUrlSubmit();
    }, 0);
  };

  const hasValidRepo = !!parsedRepo || !!repoInfo;
  const displayRepo = repoInfo || parsedRepo;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-3xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-semibold mb-4">
              Which repository would you like to learn?
            </h1>
            <p className="text-lg text-foreground/70">
              Enter a GitHub repository URL to start exploring its codebase
            </p>
          </div>

          {/* Repository Selector Card */}
          <div className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10 shadow-lg transition-all duration-300">
            {/* URL Input */}
            <div className="mb-4">
              <label htmlFor="repo-url" className="text-sm text-foreground/70 mb-2 block">
                GitHub Repository URL
              </label>
              <form onSubmit={handleUrlSubmit} className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    id="repo-url"
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleUrlSubmit();
                      }
                    }}
                    placeholder="github.com/owner/repo or owner/repo"
                    className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-base font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="px-6 py-3 rounded-xl bg-foreground text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center min-w-[100px] whitespace-nowrap"
                >
                  {isLoadingBranches ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                      Loading...
                    </span>
                  ) : (
                    'Load'
                  )}
                </button>
              </form>
            </div>

            {/* Repository Info - Always rendered, smoothly transitions */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                hasValidRepo
                  ? 'max-h-96 opacity-100 mt-4 pt-4 border-t border-foreground/10'
                  : 'max-h-0 opacity-0 mt-0 pt-0 border-t-0'
              }`}
            >
              <div className="mb-4">
                <p className="text-sm text-foreground/70 mb-1">Repository</p>
                <p className="text-base font-mono font-medium">
                  {displayRepo ? `${displayRepo.owner}/${displayRepo.repo}` : '—'}
                </p>
              </div>

              {/* Branch Selection */}
              <div className="mb-4">
                <label htmlFor="branch-select" className="text-sm text-foreground/70 mb-2 block">
                  Branch / Tag
                </label>
                <select
                  id="branch-select"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={isLoadingBranches || isLoading || !repoInfo}
                  className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-base font-mono disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <option value="master">master</option>
                  {isLoadingBranches && <option disabled>Loading branches...</option>}
                  {branches.length > 0 && (
                    <optgroup label="Recent">
                      {branches.slice(0, 10).map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {branches.length > 10 && (
                    <optgroup label="Older">
                      {branches.slice(10).map((branch) => (
                        <option key={branch.name} value={branch.name}>
                          {branch.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-foreground/10">
                <button
                  type="button"
                  onClick={() => {
                    setRepoInfo(null);
                    setBranches([]);
                    setSelectedBranch('master');
                    setInput('');
                  }}
                  className="px-4 py-2 rounded-xl border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm"
                >
                  Change Repository
                </button>
                <button
                  type="button"
                  onClick={handleStartExplorer}
                  disabled={isLoading || !repoInfo || isLoadingBranches}
                  className="flex-1 px-6 py-3 rounded-xl bg-foreground text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                      Starting...
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      Start Exploring
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Example suggestions - Hide when repo is selected */}
            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                !hasValidRepo
                  ? 'max-h-32 opacity-100 mt-4 pt-4 border-t border-foreground/10'
                  : 'max-h-0 opacity-0 mt-0 pt-0 border-t-0'
              }`}
            >
              <p className="text-sm text-foreground/70 mb-2">Quick start:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('github.com/torvalds/linux')}
                  className="px-4 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-colors text-sm font-mono"
                >
                  torvalds/linux
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('github.com/python/cpython')}
                  className="px-4 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-colors text-sm font-mono"
                >
                  python/cpython
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('github.com/bminor/glibc')}
                  className="px-4 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-colors text-sm font-mono"
                >
                  bminor/glibc
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick('github.com/llvm/llvm-project')}
                  className="px-4 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-colors text-sm font-mono"
                >
                  llvm/llvm-project
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
