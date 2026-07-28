// ============================================================
// Google Apps Script — PILOTO DE CONECTIVIDAD
// ------------------------------------------------------------
// Solo `ping()` está activo para validar identidad y rol en el Web App.
// Pull/push siguen desactivados hasta completar el piloto del dominio.
// ============================================================

const LAST_SYNC_KEY = 'trazabilidad_last_sync';
const BACKEND_URL = process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL?.trim() || '';

export interface BackendHealth {
  ok: boolean;
  time?: string;
  user?: string;
  role?: 'owner' | 'reader';
  revision?: number;
  error?: string;
}

export const APPS_SCRIPT_FETCH_OPTIONS: RequestInit = Object.freeze({
  method: 'GET',
  // Apps Script ContentService responds with Access-Control-Allow-Origin: *.
  // Credentialed CORS is therefore rejected by browsers before JS sees it.
  credentials: 'omit',
  redirect: 'follow',
});

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
  'trazabilidad_imported_batches',
  'trazabilidad_stock_assignments',
];

// --- Settings ---

export function getSheetUrl(): string {
  return BACKEND_URL;
}

export function isConfigured(): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(BACKEND_URL);
}

export function getLastSync(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LAST_SYNC_KEY) || '';
}

export function parseHealthResponse(payload: unknown): BackendHealth {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Respuesta inválida del backend' };
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) {
    const apiError = body.error && typeof body.error === 'object' ? body.error as Record<string, unknown> : {};
    return { ok: false, error: String(apiError.message || apiError.code || 'El backend rechazó la solicitud') };
  }
  if ((body.role !== 'owner' && body.role !== 'reader') || typeof body.user !== 'string' || !body.user) {
    return { ok: false, error: 'El backend no devolvió una identidad y rol válidos' };
  }
  return {
    ok: true,
    time: typeof body.serverTime === 'string' ? body.serverTime : undefined,
    user: body.user,
    role: body.role,
    revision: typeof body.revision === 'number' ? body.revision : undefined,
  };
}

// --- Piloto de red: únicamente health ---

export async function ping(): Promise<BackendHealth> {
  if (!isConfigured()) return { ok: false, error: 'Falta configurar la URL de Apps Script durante el build' };
  try {
    const url = new URL(BACKEND_URL);
    url.searchParams.set('action', 'health');
    const response = await fetch(url, APPS_SCRIPT_FETCH_OPTIONS);
    if (!response.ok) return { ok: false, error: `Apps Script respondió HTTP ${response.status}` };
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return {
        ok: false,
        error: 'Google devolvió una página de acceso en lugar de JSON. El despliegue requiere autenticación por token.',
      };
    }
    return parseHealthResponse(await response.json() as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de red';
    return { ok: false, error: `No se pudo consultar Apps Script: ${message}` };
  }
}

export async function pullFromSheets(): Promise<{ count: number; error?: string }> {
  return { count: 0, error: 'Sincronización en modo piloto: pull todavía no habilitado' };
}

export async function pushToSheets(): Promise<{ count: number; error?: string }> {
  return { count: 0, error: 'Sincronización en modo piloto: push todavía no habilitado' };
}

export async function fullSync(): Promise<{ pulled: number; pushed: number; error?: string }> {
  return { pulled: 0, pushed: 0, error: 'Sincronización en modo piloto' };
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
