'use client';

import React, { useState, useEffect } from 'react';
import { useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';

interface RepoInfo {
  name: string;
  full_name: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  language: string;
  html_url: string;
}

interface SocialLink {
  name: string;
  url: string;
  icon: React.ReactNode;
  color: string;
}

// Icon Components
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const StarIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const ForkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="currentColor"
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
  </svg>
);

interface Website {
  name: string;
  url: string;
  description?: string;
  emoji?: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'GitHub',
    url: 'https://github.com/pkill37',
    icon: <GitHubIcon className="w-4 h-4" />,
    color: 'bg-gray-900 hover:bg-gray-800',
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/f%C3%A1bio-maia-a037b7227/',
    icon: <LinkedInIcon className="w-4 h-4" />,
    color: 'bg-[#0077b5] hover:bg-[#006399]',
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/fuXYz44tSs',
    icon: <DiscordIcon className="w-4 h-4" />,
    color: 'bg-[#5865F2] hover:bg-[#4752C4]',
  },
  {
    name: 'Telegram',
    url: 'https://t.me/explorardev',
    icon: <TelegramIcon className="w-4 h-4" />,
    color: 'bg-[#0088cc] hover:bg-[#006699]',
  },
];

const WEBSITES: Website[] = [
  {
    name: 'BrainSpeed.ai',
    url: 'https://brainspeed.ai',
    description: 'AI-powered development tools',
    emoji: '🧠',
  },
  {
    name: 'Reverser.dev',
    url: 'https://reverser.dev',
    description: 'Reverse engineering platform',
    emoji: '🔄',
  },
];

function DetailedRepoWidget() {
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRepoInfo = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/pkill37/explorar.dev', {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          setRepoInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch repo info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoInfo();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-xl p-4 bg-foreground/5 border border-foreground/10 animate-pulse">
        <div className="h-4 bg-foreground/20 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-foreground/20 rounded w-full mb-3"></div>
        <div className="flex gap-4">
          <div className="h-3 bg-foreground/20 rounded w-16"></div>
          <div className="h-3 bg-foreground/20 rounded w-16"></div>
        </div>
      </div>
    );
  }

  if (!repoInfo) {
    return null;
  }

  return (
    <div className="rounded-xl p-4 bg-foreground/5 border border-foreground/10">
      <div className="flex items-center gap-2 mb-3">
        <GitHubIcon className="w-4 h-4 text-foreground/70 flex-shrink-0" />
        <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wide">
          Featured Repository
        </span>
      </div>

      <a href={repoInfo.html_url} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-foreground group-hover:text-foreground/80 mb-1.5 break-words">
            {repoInfo.full_name}
          </h3>
          {repoInfo.description && (
            <p className="text-xs text-foreground/70 leading-relaxed break-words">
              {repoInfo.description}
            </p>
          )}
        </div>
      </a>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-foreground/10">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <a
            href={`${repoInfo.html_url}/stargazers`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground transition-colors"
          >
            <StarIcon className="w-3.5 h-3.5 fill-current flex-shrink-0" />
            <span className="font-semibold">{repoInfo.stargazers_count.toLocaleString()}</span>
            <span className="text-foreground/60 hidden xs:inline">stars</span>
          </a>
          <a
            href={`${repoInfo.html_url}/network/members`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground transition-colors"
          >
            <ForkIcon className="w-3.5 h-3.5 fill-current flex-shrink-0" />
            <span className="font-semibold">{repoInfo.forks_count.toLocaleString()}</span>
            <span className="text-foreground/60 hidden xs:inline">forks</span>
          </a>
          {repoInfo.language && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-foreground/40 flex-shrink-0"></span>
              <span className="text-xs text-foreground/70 font-medium">{repoInfo.language}</span>
            </div>
          )}
        </div>
        <a
          href={repoInfo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-foreground text-background text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity text-center flex items-center justify-center"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}

interface RateLimitScreenProps {
  emoji?: string;
  title?: string;
  message?: string;
  buttonText?: string;
  onButtonClick?: () => void;
  showTimeMessage?: boolean;
}

export default function RateLimitScreen({
  emoji = '✨',
  title,
  message,
  buttonText,
  onButtonClick,
  showTimeMessage = true,
}: RateLimitScreenProps = {}) {
  const { rateLimitState, clearRateLimit } = useGitHubRateLimit();

  const formatTimeUntilReset = (resetTime: Date | null): string => {
    if (!resetTime) return 'soon';

    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();

    if (diff <= 0) return 'now';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Default values for rate limit scenario
  const displayTitle = title ?? 'Thanks for Exploring!';
  const displayMessage =
    message ??
    (showTimeMessage
      ? `We'll be back in ${formatTimeUntilReset(rateLimitState.resetTime)}`
      : undefined);
  const displayButtonText = buttonText ?? 'Try Again';
  const handleButtonClick = onButtonClick ?? clearRateLimit;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto">
          <div className="p-6 rounded-2xl bg-foreground/5 border border-foreground/10 shadow-lg transition-all duration-300">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">{emoji}</div>
              <h2 className="text-2xl font-semibold mb-2 text-foreground">{displayTitle}</h2>
              {displayMessage && (
                <p className="text-sm text-foreground/70">
                  {showTimeMessage && rateLimitState.resetTime ? (
                    <>
                      We'll be back in{' '}
                      <span className="font-medium text-foreground">
                        {formatTimeUntilReset(rateLimitState.resetTime)}
                      </span>
                    </>
                  ) : (
                    displayMessage
                  )}
                </p>
              )}
            </div>

            {/* Dedicated GitHub Repository Widget */}
            <div className="mb-6">
              <DetailedRepoWidget />
            </div>

            {/* Social Links */}
            <div className="mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SOCIAL_LINKS.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-foreground text-sm font-medium transition-all hover:border-foreground/20"
                  >
                    {link.icon}
                    <span className="hidden sm:inline">{link.name}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Websites */}
            {WEBSITES.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-3">
                  {WEBSITES.map((website, index) => (
                    <a
                      key={index}
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-all hover:border-foreground/20"
                    >
                      {website.emoji && (
                        <span className="text-sm flex-shrink-0">{website.emoji}</span>
                      )}
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">
                        {website.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleButtonClick}
              className="w-full px-6 py-3 rounded-xl bg-foreground text-background font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{displayButtonText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
