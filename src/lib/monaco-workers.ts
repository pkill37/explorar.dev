/**
 * Monaco Editor worker configuration
 * Re-exports the worker configuration from monaco-config
 * This ensures workers are properly configured when the editor mounts
 *
 * @deprecated This file is kept for backward compatibility.
 * The configuration is now handled in monaco-config.ts
 * You can import configureMonacoEnvironment directly from monaco-config instead
 */

import { configureMonacoEnvironment } from './monaco-config';

/**
 * Configure Monaco workers (ensures MonacoEnvironment is set up)
 * This is safe to call multiple times - it only sets up if not already configured
 */
export function configureMonacoWorkers(): void {
  configureMonacoEnvironment();
}
