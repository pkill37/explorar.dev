import type { NextConfig } from 'next';
import { withMonacoEditor } from './scripts/monaco-plugin';

const nextConfig: NextConfig = {
  // Enable static site generation with export
  output: 'export',

  // Disable image optimization for static export (or use unoptimized: true)
  images: {
    unoptimized: true,
  },

  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      resourceQuery: /raw/,
      type: 'asset/source',
    });
    return config;
  },

  // Configure Turbopack (Next.js 16+) to support raw markdown imports
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },
};

// Automatically copy Monaco Editor files during build/dev
export default withMonacoEditor(nextConfig);
