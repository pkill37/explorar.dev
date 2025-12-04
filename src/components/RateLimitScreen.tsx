'use client';

import React from 'react';
import { useGitHubRateLimit } from '@/contexts/GitHubRateLimitContext';

interface SocialLink {
  name: string;
  url: string;
  icon: string;
  color: string;
}

interface Website {
  name: string;
  url: string;
  description?: string;
  emoji?: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/f%C3%A1bio-maia-a037b7227/',
    icon: '💼',
    color: 'bg-[#0077b5] hover:bg-[#006399]',
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/fuXYz44tSs',
    icon: '💬',
    color: 'bg-[#5865F2] hover:bg-[#4752C4]',
  },
  {
    name: 'Telegram',
    url: 'https://t.me/explorardev',
    icon: '✈️',
    color: 'bg-[#0088cc] hover:bg-[#006699]',
  },
];

const WEBSITES: Website[] = [
  {
    name: 'GitHub Repository',
    url: 'https://github.com/pkill37/explorar.dev',
    description: 'Open source on GitHub',
    emoji: '🔓',
  },
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

export default function RateLimitScreen() {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/8 backdrop-blur-sm">
      {/* Minimal Info Card */}
      <div className="max-w-sm w-full mx-4 p-6 rounded-lg bg-background/95 border border-foreground/20 shadow-xl backdrop-blur-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⏱️</div>
          <h2 className="text-lg font-semibold mb-1">Thank You for Visiting!</h2>
          <p className="text-xs text-foreground/60">
            Please wait while we reset. Available again in{' '}
            {formatTimeUntilReset(rateLimitState.resetTime)}
          </p>
        </div>

        {/* Social Links - Minimal */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-foreground/70 mb-2">
            <span>Connect</span>
          </div>
          <div className="flex gap-2">
            {SOCIAL_LINKS.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md ${link.color} text-white text-xs font-medium transition-opacity hover:opacity-90`}
              >
                <span>{link.icon}</span>
                <span className="hidden sm:inline">{link.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Websites - Minimal */}
        {WEBSITES.length > 0 && (
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-xs text-foreground/70 mb-2">
              <span>Websites</span>
            </div>
            <div className="space-y-1.5">
              {WEBSITES.map((website, index) => (
                <a
                  key={index}
                  href={website.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 rounded-md bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {website.emoji && <span className="text-sm">{website.emoji}</span>}
                      <span className="text-xs font-medium text-foreground group-hover:text-foreground/80">
                        {website.name}
                      </span>
                    </div>
                    <svg
                      className="w-3.5 h-3.5 text-foreground/40 group-hover:text-foreground/60 transition-colors flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={clearRateLimit}
          className="w-full px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
