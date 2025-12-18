'use client';

import { useAuth } from '@/contexts/AuthContext';

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

export default function AuthButton() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

  if (isLoading) {
    return (
      <div className="px-4 py-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl text-gray-300 cursor-not-allowed opacity-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-full border border-gray-700"
        />
        <span className="text-sm text-gray-300 hidden sm:inline">{user.login}</span>
        <button
          onClick={logout}
          className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/50 text-gray-200 rounded-lg transition-colors border border-gray-700/50"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={login}
      className="group px-4 py-3 bg-gray-800/50 backdrop-blur-sm hover:bg-gray-800/70 text-left rounded-xl transition-all duration-300 border border-gray-700/50 hover:border-gray-600 hover:shadow-lg max-w-xs cursor-pointer w-full"
    >
      <div className="flex items-start gap-3 pointer-events-none">
        <div className="flex-shrink-0 mt-0.5">
          <GitHubIcon className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors mb-1">
            Join With GitHub
          </div>
          <div className="text-xs text-gray-400 leading-relaxed">
            Sign in with GitHub to join and get notified when we add support for arbitrary git
            repositories.
          </div>
        </div>
      </div>
    </button>
  );
}
