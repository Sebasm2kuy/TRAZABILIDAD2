import { describe, expect, it } from 'bun:test';
import { parseHealthResponse } from './googleSheets';

describe('parseHealthResponse', () => {
  it('acepta propietario y lector identificados por el backend', () => {
    expect(parseHealthResponse({ ok: true, user: 'owner@example.com', role: 'owner', revision: 2, serverTime: 'now' })).toEqual({
      ok: true, user: 'owner@example.com', role: 'owner', revision: 2, time: 'now',
    });
    expect(parseHealthResponse({ ok: true, user: 'reader@example.com', role: 'reader', revision: 2 }).ok).toBe(true);
  });

  it('rechaza respuestas sin identidad o rol confiable', () => {
    expect(parseHealthResponse({ ok: true, role: 'owner' }).ok).toBe(false);
    expect(parseHealthResponse({ ok: true, user: 'owner@example.com', role: 'admin' }).ok).toBe(false);
  });

  it('propaga errores funcionales de Apps Script', () => {
    expect(parseHealthResponse({ ok: false, error: { code: 'IDENTITY_UNAVAILABLE', message: 'Sin identidad' } })).toEqual({
      ok: false, error: 'Sin identidad',
    });
  });
});
