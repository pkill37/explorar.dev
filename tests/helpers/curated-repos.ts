export const CURATED_TEST_REPOS = [
  {
    owner: 'littlekernel',
    repo: 'lk',
  },
  {
    owner: 'apple-oss-distributions',
    repo: 'xnu',
  },
  {
    owner: 'torvalds',
    repo: 'linux',
  },
  {
    owner: 'python',
    repo: 'cpython',
  },
  {
    owner: 'bminor',
    repo: 'glibc',
  },
  {
    owner: 'llvm',
    repo: 'llvm-project',
  },
] as const;

export const CURATED_TEST_SITEMAP_PATHS = CURATED_TEST_REPOS.map(
  ({ owner, repo }) => `${owner}/${repo}`
);
