import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable static site generation with export
  output: 'export',

  // Disable image optimization for static export (or use unoptimized: true)
  images: {
    unoptimized: true,
  },

  // Configure Monaco Editor to use CDN
  env: {
    MONACO_EDITOR_CDN: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
  },
};

export default nextConfig;
