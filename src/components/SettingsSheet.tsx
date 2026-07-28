'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Settings, Cloud, CloudOff, CheckCircle2, XCircle,
  Loader2, Save, ShieldAlert, Trash2, Key, Lock, Eye, EyeOff, AlertTriangle, Database
} from 'lucide-react';
import { toast } from 'sonner';
import * as gs from '@/lib/googleSheets';

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_DATA_KEYS = [
  'trazabilidad_new_records',
  'trazabilidad_exp_edits',
  'trazabilidad_exp_deleted',
  'trazabilidad_exp_ingresos',
  'trazabilidad_dep_edits',
  'trazabilidad_dep_new_records',
  'trazabilidad_dep_deleted',
  'cruce_caliral_edits',
  'trazabilidad_stock_data',
  'trazabilidad_imported_batches',
  'trazabilidad_recent_searches',
  'trazabilidad_dep_imported',
  'trazabilidad_exp_imported',
  'trazabilidad_stock_assignments',
];

export default function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [pwExists, setPwExists] = useState(false);
  const [pwStep, setPwStep] = useState<'idle' | 'create' | 'verify' | 'confirm_reset'>('idle');
  const [pwInput, setPwInput] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(gs.getSheetUrl());
      setTestResult(null);
      setPwExists(gs.hasPassword());
      setPwStep('idle');
      setPwInput('');
      setPwConfirm('');
      setShowPw(false);
      setShowPwConfirm(false);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.type === 'initial-pull' || detail.type === 'pull' || detail.type === 'full') {
        if (detail.error) {
          toast.error(`Error al sincronizar: ${detail.error}`);
        } else if (detail.count > 0) {
          toast.success(`Sincronizado: ${detail.count} campos cargados de la nube`);
        }
        setPwExists(gs.hasPassword());
      } else if (detail.type === 'auto-push' || detail.type === 'push') {
        setPwExists(gs.hasPassword());
      }
    };
    window.addEventListener('sheets-sync', handler);
    return () => window.removeEventListener('sheets-sync', handler);
  }, []);

  const handleTest = async () => {
    if (!gs.isConfigured()) {
      toast.error('La URL de Apps Script no está incluida en el build');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await gs.ping();
    setTestResult({
      ok: result.ok,
      message: result.ok
        ? `Identidad: ${result.user} · Rol: ${result.role} · Revisión: ${result.revision ?? 0}`
        : (result.error || 'No se pudo conectar'),
    });
    setTesting(false);
  };

  const handleCreatePassword = async () => {
    if (pwInput.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (pwInput !== pwConfirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    await gs.setPassword(pwInput);
    setPwExists(true);
    setPwStep('idle');
    setPwInput('');
    setPwConfirm('');
    gs.schedulePush();
    toast.success('Contraseña creada y guardada');
  };

  const handleVerifyPassword = async () => {
    if (await gs.verifyPassword(pwInput)) {
      setPwStep('confirm_reset');
      setPwInput('');
    } else {
      toast.error('Contraseña incorrecta');
      setPwInput('');
    }
  };

  const handleFactoryReset = async () => {
    // This reset is deliberately local-only. Remote deletion/restoration must be
    // an authenticated owner command implemented by the Apps Script backend.
    setResetting(true);
    try {
      for (const key of ALL_DATA_KEYS) {
        localStorage.removeItem(key);
      }

      localStorage.setItem('trazabilidad_last_sync', new Date().toISOString());
      setPwStep('idle');
      toast.success('Sistema restablecido. Recargá la página.');
      onOpenChange(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('[FactoryReset] Unexpected error:', err);
      toast.error('Error al restablecer: ' + (err as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const configured = gs.isConfigured();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">

          {/* ========== APPS SCRIPT PILOT SECTION ========== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Database className="h-4 w-4 text-orange-500" />
              Backend Google Apps Script
            </h3>

            {/* Status */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${configured ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              {configured ? (
                <Cloud className="h-5 w-5 text-emerald-600" />
              ) : (
                <CloudOff className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-medium">{configured ? 'Piloto configurado' : 'No configurado'}</p>
                <p className="text-xs text-slate-500">
                  {configured
                    ? 'Pendiente de validar identidad; pull/push desactivados'
                    : 'Los datos se guardan solo en este navegador (se pierden al borrar cache)'}
                </p>
              </div>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                URL del Web App
              </label>
              <Input
                placeholder="https://script.google.com/macros/s/.../exec"
                value={url}
                readOnly
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Configurada durante el build. No contiene credenciales ni IDs de Drive.
              </p>
            </div>

            {/* Buttons row */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="w-full" onClick={handleTest} disabled={testing || !configured}>
                {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5 mr-1.5" />}
                Probar
              </Button>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            {/* How it works */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <b>Modo piloto:</b> este botón solo verifica la identidad, el rol y la revisión del backend.
                Los datos continúan en este navegador hasta aprobar las pruebas owner/reader y habilitar
                la migración de forma controlada.
              </p>
            </div>
          </div>

          {/* ========== FACTORY RESET SECTION ========== */}
          <div className="border-t pt-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Zona de Seguridad
            </h3>

            {pwStep === 'idle' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Restablecer de Fábrica</p>
                    <p className="text-xs text-red-600 mt-1">
                      Esto borra TODOS los datos del sistema (exportaciones, depósitos, cruces, stock, etc.)
                      y lo deja como recién instalado. Esta acción no se puede deshacer.
                    </p>
                  </div>
                </div>

                {!pwExists ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 bg-white rounded-md p-2 border">
                      <Key className="h-3.5 w-3.5 inline mr-1" />
                      Primero necesitás crear una contraseña para proteger esta opción.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      onClick={() => setPwStep('create')}
                    >
                      <Key className="h-3.5 w-3.5 mr-1.5" />
                      Crear contraseña y continuar
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setPwStep('verify')}
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Ingresar contraseña para restablecer
                  </Button>
                )}
              </div>
            )}

            {pwStep === 'create' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                  <Key className="h-4 w-4" />
                  Crear Contraseña de Seguridad
                </p>
                <p className="text-xs text-amber-700">
                  Esta contraseña se te pedirá cada vez que quieras restablecer el sistema.
                </p>

                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Contraseña (mínimo 4 caracteres)"
                      value={pwInput}
                      onChange={e => setPwInput(e.target.value)}
                      className="text-sm pr-9"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPwConfirm ? 'text' : 'password'}
                      placeholder="Confirmar contraseña"
                      value={pwConfirm}
                      onChange={e => setPwConfirm(e.target.value)}
                      className="text-sm pr-9"
                      onKeyDown={e => { if (e.key === 'Enter') handleCreatePassword(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwConfirm(!showPwConfirm)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPwStep('idle'); setPwInput(''); setPwConfirm(''); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleCreatePassword} disabled={!pwInput || !pwConfirm}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Guardar contraseña
                  </Button>
                </div>
              </div>
            )}

            {pwStep === 'verify' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-red-800 flex items-center gap-1.5">
                  <Lock className="h-4 w-4" />
                  Ingresar Contraseña
                </p>
                <p className="text-xs text-red-600">
                  Ingresá tu contraseña de seguridad para acceder al restablecimiento de fábrica.
                </p>

                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Tu contraseña"
                    value={pwInput}
                    onChange={e => setPwInput(e.target.value)}
                    className="text-sm pr-9"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleVerifyPassword(); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPwStep('idle'); setPwInput(''); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={handleVerifyPassword} disabled={!pwInput}>
                    Verificar
                  </Button>
                </div>
              </div>
            )}

            {pwStep === 'confirm_reset' && (
              <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-bold text-red-800">Ultima confirmación</p>
                </div>
                <p className="text-xs text-red-700">
                  Estás a punto de borrar <b>TODO</b>: exportaciones, depósitos, cruces caliral, stock cargado,
                  importaciones y búsquedas recientes de este navegador. El backend y sus backups no se modificarán.
                  <b> Esta acción local es irreversible.</b>
                </p>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPwStep('idle')}>
                    Cancelar (no borrar)
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={handleFactoryReset}
                    disabled={resetting}
                  >
                    {resetting ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {resetting ? 'Borrando...' : 'SI, borrar todo'}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
