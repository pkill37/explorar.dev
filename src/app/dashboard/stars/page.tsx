'use client';

import { useEffect, useState } from 'react';
import { getUserStars, StarredRepo } from '@/lib/worker-api';
import { useRouter } from 'next/navigation';

export default function StarsPage() {
  const router = useRouter();
  const [stars, setStars] = useState<StarredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStars = async () => {
      try {
        setLoading(true);
        const data = await getUserStars();
        setStars(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load stars:', err);
        setError(err instanceof Error ? err.message : 'Failed to load starred repositories');
      } finally {
        setLoading(false);
      }
    };

    loadStars();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading starred repositories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Starred Repositories</h1>
        <p className="text-gray-400">
          {stars.length} {stars.length === 1 ? 'repository' : 'repositories'}
        </p>
      </div>

      {stars.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
          <p className="text-gray-500">You haven't starred any repositories yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stars.map((star, idx) => (
            <div
              key={idx}
              className="p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all cursor-pointer hover:shadow-lg"
              onClick={() => router.push(`/${star.repo_owner}/${star.repo_name}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-bold text-gray-200 truncate">
                    {star.repo_owner}/{star.repo_name}
                  </p>
                </div>
                {star.language && (
                  <span className="ml-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded flex-shrink-0">
                    {star.language}
                  </span>
                )}
              </div>

              {star.description && (
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">{star.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500">
                {star.stargazers_count !== undefined && (
                  <span>⭐ {star.stargazers_count.toLocaleString()}</span>
                )}
                <span>{new Date(star.starred_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
