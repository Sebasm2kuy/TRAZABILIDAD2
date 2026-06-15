// ============================================================
// Cloud Sync - Firebase Realtime Database (REST API)
// ============================================================
// Uses Firebase Realtime Database REST API for cloud sync.
// Works from any origin (GitHub Pages, Vercel, localhost, etc.)
// No SDK needed — just fetch to the database URL.
// ============================================================

const SETTINGS_KEY = 'trazabilidad_firebase_url';
const LAST_SYNC_KEY = 'trazabilidad_last_sync';
const SYNC_DEBOUNCE_MS = 3000; // Wait 3s after last change before pushing

// All localStorage keys that need to be synced
export const SYNC_KEYS = [
  'trazabilidad_new_records',
  'trazabilidad_exp_edits',
  'trazabilidad_exp_deleted',
  'trazabilidad_exp_ingresos',
  'trazabilidad_dep_edits',
  'trazabilidad_dep_new_records',
  'trazabilidad_dep_deleted',
  'cruce_caliral_edits',
  'trazabilidad_stock_data',
  'trazabilidad_system_password',
  'trazabilidad_dep_imported',
  'trazabilidad_exp_imported',
  'trazabilidad_stock_assignments',
];

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

// --- Settings ---

export function getSheetUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SETTINGS_KEY) || '';
}

export function setSheetUrl(url: string) {
  if (typeof window === 'undefined') return;
  // Clean trailing slash
  const cleaned = url.trim().replace(/\/+$/, '');
  localStorage.setItem(SETTINGS_KEY, cleaned);
}

export function isConfigured(): boolean {
  const url = getSheetUrl();
  return url.length > 20; // Firebase URLs are long
}

export function getLastSync(): string {
  return localStorage.getItem(LAST_SYNC_KEY) || '';
}

// --- Firebase REST API calls ---

interface SyncData {
  [key: string]: unknown;
}

async function firebaseGet(url: string): Promise<SyncData | null> {
  try {
    const resp = await fetch(`${url}/.json`, {
      method: 'GET',
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Firebase GET ${resp.status}: ${text.slice(0, 100)}`);
    }
    const data = await resp.json();
    // Firebase returns null for empty database
    if (data === null || typeof data !== 'object') return {};
    return data as SyncData;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      console.warn('Firebase: no se pudo conectar (red/CORS)');
      return null;
    }
    throw err;
  }
}

async function firebasePut(url: string, data: SyncData): Promise<boolean> {
  try {
    const resp = await fetch(`${url}/.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Firebase PUT ${resp.status}: ${text.slice(0, 100)}`);
    }
    return true;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      console.warn('Firebase: no se pudo conectar (red/CORS)');
      return false;
    }
    throw err;
  }
}

// --- Collect all local data ---

function collectLocalData(): SyncData {
  const data: SyncData = {};
  for (const key of SYNC_KEYS) {
    try {
      const val = localStorage.getItem(key);
      if (val !== null && val !== undefined) {
        data[key] = JSON.parse(val);
      }
    } catch {
      // skip
    }
  }
  return data;
}

// --- Public API ---

/**
 * Test connection to Firebase
 */
export async function ping(): Promise<{ ok: boolean; time?: string; error?: string }> {
  const url = getSheetUrl();
  if (!url) return { ok: false, error: 'No configurada la URL de Firebase' };
  try {
    const start = Date.now();
    const data = await firebaseGet(url);
    const ms = Date.now() - start;
    if (data !== null) {
      return { ok: true, time: new Date().toISOString() };
    }
    return { ok: false, error: 'No se pudo leer la base de datos. Verificá las reglas de seguridad.' };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Pull all data from Firebase and merge into localStorage.
 * Remote data is written to localStorage for each key.
 */
export async function pullFromSheets(): Promise<{ count: number; error?: string }> {
  const url = getSheetUrl();
  if (!url) return { count: 0, error: 'No configurada' };
  if (isSyncing) return { count: 0, error: 'Sync en progreso' };
  isSyncing = true;

  try {
    const remote = await firebaseGet(url);
    if (!remote) return { count: 0, error: 'No se pudo conectar a Firebase' };

    let count = 0;
    for (const key of SYNC_KEYS) {
      if (remote[key] !== undefined && remote[key] !== null) {
        const val = typeof remote[key] === 'string' ? remote[key] : JSON.stringify(remote[key]);
        localStorage.setItem(key, val);
        count++;
      }
    }

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    dispatchSyncEvent('pull', { count });
    return { count };
  } catch (err) {
    return { count: 0, error: (err as Error).message };
  } finally {
    isSyncing = false;
  }
}

/**
 * Push all local data to Firebase (local wins).
 */
export async function pushToSheets(): Promise<{ count: number; error?: string }> {
  const url = getSheetUrl();
  if (!url) return { count: 0, error: 'No configurada' };
  if (isSyncing) return { count: 0, error: 'Sync en progreso' };
  isSyncing = true;

  try {
    // First pull remote to merge
    const remote = await firebaseGet(url);
    const remoteData: SyncData = remote || {};

    // Collect local data
    const localData = collectLocalData();

    // Merge: local wins for keys that exist locally
    const merged: SyncData = { ...remoteData, ...localData };

    const keys = Object.keys(localData);
    if (keys.length === 0) return { count: 0 };

    // Push merged data
    const ok = await firebasePut(url, merged);
    if (ok) {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      dispatchSyncEvent('push', { count: keys.length });
      return { count: keys.length };
    }
    return { count: 0, error: 'No se pudo escribir en Firebase' };
  } catch (err) {
    return { count: 0, error: (err as Error).message };
  } finally {
    isSyncing = false;
  }
}

/**
 * Full bidirectional sync: pull → merge (local wins) → push
 */
export async function fullSync(): Promise<{ pulled: number; pushed: number; error?: string }> {
  const url = getSheetUrl();
  if (!url) return { pulled: 0, pushed: 0, error: 'No configurada' };
  if (isSyncing) return { pulled: 0, pushed: 0, error: 'Sync en progreso' };
  isSyncing = true;

  try {
    // 1. Collect local
    const localData = collectLocalData();

    // 2. Pull remote
    const remote = await firebaseGet(url);
    const remoteData: SyncData = remote || {};

    // 3. Merge: local wins for keys that exist locally
    const merged: SyncData = { ...remoteData, ...localData };

    // 4. Write merged to localStorage
    for (const key of SYNC_KEYS) {
      if (merged[key] !== undefined && merged[key] !== null) {
        const val = typeof merged[key] === 'string' ? merged[key] : JSON.stringify(merged[key]);
        localStorage.setItem(key, val);
      }
    }

    // 5. Push merged to Firebase
    const keys = Object.keys(merged);
    const ok = await firebasePut(url, merged);

    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    dispatchSyncEvent('full', { pulled: Object.keys(remoteData).length, pushed: keys.length });

    return {
      pulled: Object.keys(remoteData).length,
      pushed: ok ? keys.length : 0,
    };
  } catch (err) {
    return { pulled: 0, pushed: 0, error: (err as Error).message };
  } finally {
    isSyncing = false;
  }
}

/**
 * Schedule a debounced push. Useful for auto-save after edits.
 * Waits SYNC_DEBOUNCE_MS after the last call before actually pushing.
 */
export function schedulePush() {
  if (!isConfigured()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const result = await pushToSheets();
    dispatchSyncEvent('auto-push', result);
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Initial pull from Firebase on app load.
 */
export async function initialPull(): Promise<{ count: number; error?: string }> {
  const url = getSheetUrl();
  if (!url) return { count: 0 };

  const result = await pullFromSheets();
  dispatchSyncEvent('initial-pull', result);
  return result;
}

// --- Event dispatching ---

function dispatchSyncEvent(type: string, detail: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sheets-sync', { detail: { type, ...detail } }));
  }
}

// --- Password management (local + synced via Firebase) ---

const PASSWORD_KEY = 'trazabilidad_system_password';

function simpleHash(str: string): string {
  let hash = 5381;
  const salted = 'trazabilidad_salt_' + str;
  for (let i = 0; i < salted.length; i++) {
    hash = ((hash << 5) + hash + salted.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}

export function hasPassword(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(PASSWORD_KEY);
}

export function setPassword(pw: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PASSWORD_KEY, simpleHash(pw));
}

export function verifyPassword(pw: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(PASSWORD_KEY);
  if (!stored) return false;
  return stored === simpleHash(pw);
}