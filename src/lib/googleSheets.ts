// ============================================================
// Google Sheets Sync - Client-side module (DISABLED)
// ============================================================
// Auto-sync is disabled because it causes CORS errors on
// GitHub Pages (static site). Google Apps Script requires
// same-origin or proper CORS headers.
//
// The sync UI in Settings is kept for future use if deployed
// on a domain with proper CORS support.
// ============================================================

const SETTINGS_KEY = 'trazabilidad_sheets_url';
const LAST_SYNC_KEY = 'trazabilidad_sheets_last_sync';

// All localStorage keys that need to be synced (kept for reference)
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
];

// --- Settings ---

export function getSheetUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(SETTINGS_KEY) || '';
}

export function setSheetUrl(url: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, url.trim());
}

export function isConfigured(): boolean {
  const url = getSheetUrl();
  return url.length > 10;
}

export function getLastSync(): string {
  return localStorage.getItem(LAST_SYNC_KEY) || '';
}

// --- All sync functions are no-ops (disabled to prevent CORS errors) ---

export function schedulePush() {
  // NO-OP: disabled to prevent CORS errors on GitHub Pages
}

export async function initialPull(): Promise<{ count: number; error?: string }> {
  // NO-OP: disabled to prevent CORS errors on GitHub Pages
  return { count: 0 };
}

export async function pullFromSheets(): Promise<{ count: number; error?: string }> {
  // NO-OP: disabled to prevent CORS errors
  return { count: 0 };
}

export async function pushToSheets(): Promise<{ count: number; error?: string }> {
  // NO-OP: disabled to prevent CORS errors
  return { count: 0 };
}

export async function fullSync(): Promise<{ pulled: number; pushed: number; error?: string }> {
  // NO-OP: disabled to prevent CORS errors
  return { pulled: 0, pushed: 0 };
}

export async function ping(): Promise<{ ok: boolean; time?: string; error?: string }> {
  // NO-OP: disabled to prevent CORS errors
  return { ok: false, error: 'Sincronización deshabilitada en este entorno' };
}

// --- Password management (local only, no sync) ---

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