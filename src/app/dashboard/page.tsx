'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getUserStars, getExploredRepos, StarredRepo, ExploredRepo } from '@/lib/worker-api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stars, setStars] = useState<StarredRepo[]>([]);
  const [explored, setExplored] = useState<ExploredRepo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [starsData, exploredData] = await Promise.all([
          getUserStars().catch(() => []),
          getExploredRepos().catch(() => []),
        ]);
        setStars(starsData.slice(0, 6));
        setExplored(exploredData.slice(0, 6));
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Welcome, {user?.login || 'User'}!</h1>
        <p className="text-gray-400">Your exploration dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stars Section */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-200">Starred Repositories</h2>
            <Link
              href="/dashboard/stars"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All →
            </Link>
          </div>
          {stars.length === 0 ? (
            <p className="text-gray-500 text-sm">No starred repositories yet</p>
          ) : (
            <div className="space-y-3">
              {stars.map((star, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${star.repo_owner}/${star.repo_name}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-gray-200 truncate">
                        {star.repo_owner}/{star.repo_name}
                      </p>
                      {star.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {star.description}
                        </p>
                      )}
                    </div>
                    {star.language && (
                      <span className="ml-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded flex-shrink-0">
                        {star.language}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explored Repos Section */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-200">Recently Explored</h2>
          </div>
          {explored.length === 0 ? (
            <p className="text-gray-500 text-sm">No explored repositories yet</p>
          ) : (
            <div className="space-y-3">
              {explored.map((repo, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-gray-600 transition-colors cursor-pointer"
                  onClick={() => router.push(`/${repo.repo_owner}/${repo.repo_name}`)}
                >
                  <p className="text-sm font-mono text-gray-200">
                    {repo.repo_owner}/{repo.repo_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(repo.explored_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Network Section */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-200">Following & Followers Network</h2>
          <Link
            href="/dashboard/network"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Network →
          </Link>
        </div>
        <p className="text-gray-500 text-sm">
          Visualize your GitHub network of following and followers
        </p>
      </div>
    </div>
  );
}
