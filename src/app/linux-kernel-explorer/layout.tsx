import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://explorar.dev';

// Metadata automatically inherits OG images, favicons, and other defaults from root layout
// Only override specific fields that need to be different for this page
// Note: When overriding openGraph, we must explicitly include images to ensure they're not lost
export const metadata: Metadata = {
  title: "Linux Kernel Explorer",
  description: "Interactive Linux kernel source code browser with guided learning paths and comprehensive kernel exploration tools.",
  openGraph: {
    title: "Linux Kernel Explorer | explorar.dev",
    description: "Interactive Linux kernel source code browser with guided learning paths.",
    url: `${siteUrl}/linux-kernel-explorer`,
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Linux Kernel Explorer | explorar.dev",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Linux Kernel Explorer | explorar.dev",
    description: "Interactive Linux kernel source code browser with guided learning paths.",
    images: [`${siteUrl}/og-image.png`] as string[],
  },
};

export default function KernelExplorerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

