import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure Monaco Editor to use CDN
  env: {
    MONACO_EDITOR_CDN: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
  },
};

export default nextConfig;
