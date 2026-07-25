// ============================================================
// AUTH — Sistema simple de autenticación por roles
// ------------------------------------------------------------
// Dos usuarios hardcodeados:
//   - comercial / comercial  → solo pestaña Clientes Estratégicos
//   - supervisor / supervisor → acceso total
//
// La sesión se guarda en localStorage con expiración de 8 horas.
// ============================================================

export type UserRole = 'comercial' | 'supervisor';

export interface AuthUser {
  username: string;
  role: UserRole;
  loginAt: number;
  expiresAt: number;
}

interface UserInfo {
  username: string;
  password: string;
  role: UserRole;
}

const USERS: UserInfo[] = [
  { username: 'comercial', password: 'comercial', role: 'comercial' },
  { username: 'supervisor', password: 'supervisor', role: 'supervisor' },
];

const SESSION_KEY = 'trazabilidad_auth_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas

export function login(username: string, password: string): AuthUser | null {
  const user = USERS.find(
    u => u.username === username.trim().toLowerCase() && u.password === password,
  );
  if (!user) return null;

  const now = Date.now();
  const session: AuthUser = {
    username: user.username,
    role: user.role,
    loginAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };
  saveSession(session);
  return session;
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('trazabilidad-auth-change'));
}

export function getSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthUser;
    if (Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function saveSession(session: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('trazabilidad-auth-change'));
}

export function getAllowedTabs(role: UserRole): string[] {
  if (role === 'supervisor') {
    return [
      'dashboard', 'depositos', 'exportaciones',
      'cruce-caliral', 'cruces-x-cote', 'mercado-nacional',
      'trazabilidad-explorer', 'trazabilidad', 'comparativa',
      'analiticas', 'importar', 'nuevo', 'clientes-estrategicos',
    ];
  }
  // comercial: solo Clientes Estratégicos
  return ['clientes-estrategicos'];
}

export function getRoleLabel(role: UserRole): string {
  return role === 'supervisor' ? 'Supervisor' : 'Comercial';
}

export function onAuthChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('trazabilidad-auth-change', callback);
  return () => window.removeEventListener('trazabilidad-auth-change', callback);
}
