'use client';

import { useEffect, useRef } from 'react';
import { useViewport } from '@xyflow/react';

/** Zoom level at which the editor opens automatically */
export const ENTRY_ZOOM_THRESHOLD = 2.3;
/** Zoom level at which the entry glow starts building up */
export const ENTRY_APPROACH_START = 1.4;
/** Delay before actually entering, so accidental over-zoom doesn't trigger it */
const ENTRY_DELAY_MS = 700;

interface ZoomWatcherProps {
  selectedFilePath: string | null;
  onEnterFile: (filePath: string) => void;
}

/**
 * Rendered inside the ReactFlow tree so it can call useViewport().
 * Fires onEnterFile when the user zooms past the threshold on a selected node.
 */
export function ZoomWatcher({ selectedFilePath, onEnterFile }: ZoomWatcherProps) {
  const { zoom } = useViewport();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which file has already been entered to avoid double-firing
  const enteredRef = useRef<string | null>(null);

  // Auto-enter when zoom passes threshold
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (
      selectedFilePath &&
      zoom >= ENTRY_ZOOM_THRESHOLD &&
      enteredRef.current !== selectedFilePath
    ) {
      const filePath = selectedFilePath;
      timerRef.current = setTimeout(() => {
        enteredRef.current = filePath;
        onEnterFile(filePath);
      }, ENTRY_DELAY_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [zoom, selectedFilePath, onEnterFile]);

  return null;
}
