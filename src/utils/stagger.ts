const MAX_STAGGER_MS = 600;

export function computeStaggerMs(dbCount: number): number {
  return dbCount <= 1 ? 0 : Math.min(50, MAX_STAGGER_MS / (dbCount - 1));
}

export function computeDelay(idx: number, dbCount: number): number {
  return Math.round(idx * computeStaggerMs(dbCount));
}
