import { debugLog } from './browser-debug';

export type FileFetchSource = 'r2-bucket' | 'github-api' | 'local-filesystem' | 'unknown';

export interface FileFetchDebugInfo {
  enabled: boolean;
  source: FileFetchSource;
  requestUrl: string;
  responseUrl?: string;
  responseStatus?: number;
  cacheStatus?: string | null;
  r2Key?: string | null;
  contentLength?: string | null;
}

export interface FileFetchResult {
  content: string;
  debugInfo?: FileFetchDebugInfo;
}

export function logFileFetchDebugInfo(debugInfo: FileFetchDebugInfo | undefined): void {
  if (!debugInfo?.enabled) {
    return;
  }

  debugLog('[explorar:file-fetch]', debugInfo);
}
