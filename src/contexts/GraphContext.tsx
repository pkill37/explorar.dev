'use client';

import { createContext, useContext } from 'react';
import type { FileSymbols } from '@/lib/code-analysis';

export interface GraphContextValue {
  owner: string;
  repo: string;
  branch: string;
  selectedFilePath: string | null;
  /** Extracted symbols per file path — populated after analysis completes */
  symbolsMap: Map<string, FileSymbols>;
  /** True while background analysis is still running */
  analysisLoading: boolean;
}

export const GraphContext = createContext<GraphContextValue>({
  owner: '',
  repo: '',
  branch: '',
  selectedFilePath: null,
  symbolsMap: new Map(),
  analysisLoading: false,
});

export function useGraphContext(): GraphContextValue {
  return useContext(GraphContext);
}
