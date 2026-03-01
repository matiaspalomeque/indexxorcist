import { useState, useEffect } from "react";

/**
 * Hook that returns the elapsed time in seconds since the given start timestamp.
 * Updates every second while the run is active.
 */
export function useElapsedTime(startedAtMs: number, isActive: boolean): number {
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    const elapsed = () => Math.floor((Date.now() - startedAtMs) / 1000);
    setElapsedSecs(elapsed());

    if (!isActive) return;

    const interval = setInterval(() => setElapsedSecs(elapsed()), 1000);
    return () => clearInterval(interval);
  }, [startedAtMs, isActive]);

  return elapsedSecs;
}

/**
 * Formats seconds into a human-readable string like "5m 32s" or "1h 23m"
 */
export function formatElapsedTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${secs}s`;
}

/**
 * Calculate estimated time remaining based on current progress
 */
export function calculateETA(
  completedCount: number,
  totalCount: number,
  elapsedSecs: number
): string | null {
  if (completedCount === 0 || totalCount === 0) {
    return null;
  }

  const avgSecsPerItem = elapsedSecs / completedCount;
  const remainingItems = totalCount - completedCount;
  const estimatedRemainingSecs = Math.round(avgSecsPerItem * remainingItems);

  if (estimatedRemainingSecs < 1) {
    return "< 1s";
  }

  return formatElapsedTime(estimatedRemainingSecs);
}
