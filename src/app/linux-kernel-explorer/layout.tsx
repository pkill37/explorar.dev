import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

// Metadata automatically inherits OG images, favicons, and other defaults from root layout
// Only override specific fields that need to be different for this page
// Note: When overriding openGraph, we must explicitly include images to ensure they're not lost
export const metadata: Metadata = {
  title: 'Explorar.dev - Source Code Explorer',
  description:
    'Interactive source code browser with guided learning paths. Explore the Linux kernel, Python CPython, glibc, LLVM, and any GitHub repository with an intuitive VS Code-like interface.',
  keywords: [
    'source code explorer',
    'code browser',
    'interactive learning',
    'Linux kernel',
    'CPython source code',
    'glibc exploration',
    'LLVM code browser',
    'GitHub repository explorer',
    'software learning',
  ],
  openGraph: {
    title: 'Explorar.dev - Source Code Explorer | explorar.dev',
    description:
      'Interactive source code browser with guided learning paths. Explore any software source code with an intuitive VS Code-like interface.',
    url: `${siteUrl}/linux-kernel-explorer`,
    type: 'website',
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1200,
        height: 630,
        alt: 'Explorar.dev - Source Code Explorer | explorar.dev',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explorar.dev - Source Code Explorer | explorar.dev',
    description: 'Interactive source code browser with guided learning paths.',
    images: [`${siteUrl}/og.png`] as string[],
  },
  alternates: {
    canonical: `${siteUrl}/linux-kernel-explorer`,
  },
};

export default function KernelExplorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
