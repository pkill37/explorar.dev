export const CURATED_TEST_REPOS = [
  {
    owner: 'littlekernel',
    repo: 'lk',
    slug: 'little-kernel',
  },
  {
    owner: 'seL4',
    repo: 'seL4',
    slug: 'sel4-microkernel',
  },
  {
    owner: 'apple-oss-distributions',
    repo: 'xnu',
    slug: 'xnu-kernel',
  },
  {
    owner: 'torvalds',
    repo: 'linux',
    slug: 'linux-kernel',
  },
  {
    owner: 'python',
    repo: 'cpython',
    slug: 'cpython',
  },
  {
    owner: 'bminor',
    repo: 'glibc',
    slug: 'gnu-c-library',
  },
  {
    owner: 'llvm',
    repo: 'llvm-project',
    slug: 'llvm-project',
  },
] as const;

export const CURATED_TEST_SITEMAP_PATHS = CURATED_TEST_REPOS.map(({ slug }) => slug);
