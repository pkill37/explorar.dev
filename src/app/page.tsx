"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { setGitHubRepo, fetchKernelVersions } from "@/lib/github-api";
import type { GitHubTag } from "@/types";

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branches, setBranches] = useState<GitHubTag[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("master");
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string } | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse GitHub URL
  const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    const trimmed = url.trim();
    // Handle various formats: github.com/owner/repo, owner/repo, https://github.com/owner/repo
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
          repo: match[2].replace(/\.git$/, ""),
        };
      }
    }

    return null;
  };

  const handleUrlSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || isLoadingBranches) return;

    const parsed = parseGitHubUrl(input.trim());
    if (!parsed) {
      alert("Please enter a valid GitHub URL (e.g., github.com/owner/repo or owner/repo)");
      return;
    }

    setIsLoadingBranches(true);
    try {
      // Set the repo to fetch branches
      setGitHubRepo(parsed.owner, parsed.repo, "master");
      
      // Fetch branches/tags
      const fetchedBranches = await fetchKernelVersions();
      setBranches(fetchedBranches);
      setRepoInfo(parsed);
      setSelectedBranch("master");
      setIsLoadingBranches(false);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
      alert(
        error instanceof Error
          ? `Failed to fetch branches: ${error.message}`
          : "Failed to fetch branches. Please check the repository URL."
      );
      setIsLoadingBranches(false);
    }
  };

  const handleStartExplorer = () => {
    if (!repoInfo || isLoading) return;

    setIsLoading(true);
    try {
      // Set the repo with selected branch
      setGitHubRepo(repoInfo.owner, repoInfo.repo, selectedBranch);
      
      // Store in localStorage for the explorer page
      if (typeof window !== "undefined") {
        const githubUrl = `github.com/${repoInfo.owner}/${repoInfo.repo}`;
        localStorage.setItem("kernel-explorer-github-url", githubUrl);
        localStorage.setItem("kernel-explorer-selected-version", selectedBranch);
      }

      // Navigate to explorer
      router.push("/linux-kernel-explorer");
    } catch (error) {
      console.error("Failed to start explorer:", error);
      alert("Failed to start explorer. Please try again.");
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


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-3xl mx-auto">
          {/* Welcome Message */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-semibold mb-4">Which repository would you like to learn?</h1>
            <p className="text-lg text-foreground/70">
              Enter a GitHub repository URL to start exploring its codebase
            </p>
          </div>

          {/* Repository Selector Card */}
          <div className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10 shadow-lg">
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
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUrlSubmit();
                      }
                    }}
                    placeholder="github.com/owner/repo or owner/repo"
                    className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-base font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || isLoadingBranches}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || isLoadingBranches}
                  className="px-6 py-3 rounded-xl bg-foreground text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center min-w-[100px] whitespace-nowrap"
                >
                  {isLoadingBranches ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                      Loading...
                    </span>
                  ) : (
                    "Load"
                  )}
                </button>
              </form>
            </div>

            {/* Repository Info */}
            {repoInfo && (
              <>
                <div className="mb-4 pt-4 border-t border-foreground/10">
                  <p className="text-sm text-foreground/70 mb-1">Repository</p>
                  <p className="text-base font-mono font-medium">{repoInfo.owner}/{repoInfo.repo}</p>
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
                    disabled={isLoadingBranches || isLoading}
                    className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-base font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="master">master</option>
                    {isLoadingBranches && (
                      <option disabled>Loading branches...</option>
                    )}
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
                      setSelectedBranch("master");
                      setInput("");
                    }}
                    className="px-4 py-2 rounded-xl border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm"
                  >
                    Change Repository
                  </button>
                  <button
                    type="button"
                    onClick={handleStartExplorer}
                    disabled={isLoading}
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
              </>
            )}

            {/* Example suggestions */}
            {!repoInfo && (
              <div className="mt-4 pt-4 border-t border-foreground/10">
                <p className="text-sm text-foreground/70 mb-2">Quick start:</p>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick("github.com/torvalds/linux")}
                  className="px-4 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-colors text-sm font-mono"
                >
                  torvalds/linux
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
