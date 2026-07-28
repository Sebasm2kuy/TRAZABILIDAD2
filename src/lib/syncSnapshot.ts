export interface SyncStorage {
  // eslint-disable-next-line no-unused-vars
  getItem(key: string): string | null;
}

export interface SyncSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  mutationId: string;
  data: Record<string, unknown>;
  skippedKeys: string[];
}

export function createSyncSnapshot(
  storage: SyncStorage,
  keys: readonly string[],
  options: { now?: Date; mutationId?: string } = {},
): SyncSnapshot {
  const data: Record<string, unknown> = {};
  const skippedKeys: string[] = [];

  for (const key of keys) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw) as unknown;
    } catch {
      skippedKeys.push(key);
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: (options.now ?? new Date()).toISOString(),
    mutationId: options.mutationId ?? crypto.randomUUID(),
    data,
    skippedKeys,
  };
}
