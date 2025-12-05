import { Suspense } from 'react';
import PullRequestLearner from '@/components/PullRequestLearner';
import LoadingScreen from '@/components/LoadingScreen';

// For static export, we need to provide generateStaticParams
// Pre-generate some example PRs from popular repositories
// Note: With static export, only these pre-generated routes will be available
export async function generateStaticParams() {
  // Return example PRs from popular repositories
  // These will be pre-generated during build
  return [
    // LLVM PRs (for compiler engineering)
    { owner: 'llvm', repo: 'llvm-project', prNumber: '1' },
    { owner: 'llvm', repo: 'llvm-project', prNumber: '100' },
    { owner: 'llvm', repo: 'llvm-project', prNumber: '500' },
    { owner: 'llvm', repo: 'llvm-project', prNumber: '170752' },
    // Linux kernel PRs
    { owner: 'torvalds', repo: 'linux', prNumber: '1' },
    // Python CPython PRs
    { owner: 'python', repo: 'cpython', prNumber: '1' },
    // glibc PRs
    { owner: 'bminor', repo: 'glibc', prNumber: '1' },
  ];
}

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
    prNumber: string;
  }>;
}

export default async function PullRequestPage({ params }: PageProps) {
  const { owner, repo, prNumber } = await params;
  const prNum = parseInt(prNumber, 10);

  if (isNaN(prNum)) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        Invalid PR number
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <PullRequestLearner owner={owner} repo={repo} prNumber={prNum} />
    </Suspense>
  );
}
