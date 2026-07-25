// ============================================================
// Cloud Sync — DESACTIVADO (sin Firebase)
// ------------------------------------------------------------
// Firebase fue reemplazado por:
//   - Datos del mercado nacional: public/embarques.xlsx (loader local)
//   - Persistencia de ediciones: localStorage (sin sync cloud)
//
// Esta archivo mantiene las firmas de funciones exportadas para no
// romper imports en componentes que aún llaman a schedulePush(),
// initialPull(), etc. — pero todas las operaciones de red son no-op.
//
// Para reactivar Firebase en el futuro, restaurar desde
// googleSheets.ts.bak (versión con REST API completa).
// ============================================================

const LAST_SYNC_KEY = 'trazabilidad_last_sync';

// Mantenido por compat con componentes que lo importan
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
  'trazabilidad_dep_imported',
  'trazabilidad_exp_imported',
  'trazabilidad_stock_assignments',
];

// --- Settings ---

export function getSheetUrl(): string {
  return '';  // Firebase desactivado
}

export function setSheetUrl(_url: string) {
  // No-op
}

export function isConfigured(): boolean {
  return false;  // Firebase desactivado
}

export function getLastSync(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LAST_SYNC_KEY) || '';
}

// --- Operaciones de red (todas no-op) ---

export async function ping(): Promise<{ ok: boolean; time?: string; error?: string }> {
  return { ok: false, error: 'Firebase desactivado — usando archivo embarques.xlsx local' };
}

export async function pullFromSheets(): Promise<{ count: number; error?: string }> {
  return { count: 0, error: 'Firebase desactivado' };
}

export async function pushToSheets(): Promise<{ count: number; error?: string }> {
  return { count: 0, error: 'Firebase desactivado' };
}

export async function fullSync(): Promise<{ pulled: number; pushed: number; error?: string }> {
  return { pulled: 0, pushed: 0, error: 'Firebase desactivado' };
}

export function schedulePush() {
  // No-op: las ediciones se guardan solo en localStorage
}

export async function initialPull(): Promise<{ count: number; error?: string }> {
  // No-op: los datos se cargan desde embarques.xlsx vía embarquesLoader
  return { count: 0 };
}

// --- Password management (mantenido por compat con SettingsSheet) ---
// Las passwords siguen en localStorage para el reset de fábrica.

const PASSWORD_KEY = 'trazabilidad_system_password';
const PBKDF2_SALT_KEY = 'trazabilidad_pbkdf2_salt';
const PBKDF2_ITERATIONS = 100_000;
const HASH_PREFIX = 'pbkdf2$';

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return HASH_PREFIX + 'fallback$' + simpleHash(password + salt);
  }
  try {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
    );
    const bits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      256,
    );
    const arr = Array.from(new Uint8Array(bits));
    return HASH_PREFIX + arr.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return HASH_PREFIX + 'fallback$' + simpleHash(password + salt);
  }
}

export function hasPassword(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(PASSWORD_KEY);
}

export async function setPassword(pw: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const hash = await pbkdf2Hash(pw, salt);
  localStorage.setItem(PASSWORD_KEY, hash);
  localStorage.setItem(PBKDF2_SALT_KEY, salt);
}

export async function verifyPassword(pw: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(PASSWORD_KEY);
  if (!stored) return true;  // Sin password = acceso libre
  const salt = localStorage.getItem(PBKDF2_SALT_KEY) || '';
  const hash = await pbkdf2Hash(pw, salt);
  return hash === stored;
}
