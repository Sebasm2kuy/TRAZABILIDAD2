import { describe, expect, it } from 'bun:test';
import { createSyncSnapshot, type SyncStorage } from './syncSnapshot';

const storage = (values: Record<string, string>): SyncStorage => ({
  getItem: key => values[key] ?? null,
});

describe('createSyncSnapshot', () => {
  it('crea un payload versionado y conserva únicamente las claves permitidas', () => {
    const snapshot = createSyncSnapshot(
      storage({ batches: '[{"id":"one"}]', password: '"secret"', session: '"admin"' }),
      ['batches'],
      { now: new Date('2026-07-28T12:00:00.000Z'), mutationId: 'mutation-1' },
    );
    expect(snapshot).toEqual({
      schemaVersion: 1,
      generatedAt: '2026-07-28T12:00:00.000Z',
      mutationId: 'mutation-1',
      data: { batches: [{ id: 'one' }] },
      skippedKeys: [],
    });
  });

  it('omite valores ausentes e informa JSON local corrupto', () => {
    const snapshot = createSyncSnapshot(storage({ corrupt: '{' }), ['missing', 'corrupt'], {
      now: new Date('2026-07-28T12:00:00.000Z'),
      mutationId: 'mutation-2',
    });
    expect(snapshot.data).toEqual({});
    expect(snapshot.skippedKeys).toEqual(['corrupt']);
  });
});
