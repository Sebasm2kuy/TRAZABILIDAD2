'use client';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Settings, Cloud, CloudOff, RefreshCw, CheckCircle2, XCircle,
  Loader2, ExternalLink, Save, ShieldAlert, Trash2, Key, Lock, Eye, EyeOff, AlertTriangle, Database
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
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('');

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
      setLastSync(gs.getLastSync());
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
        setLastSync(gs.getLastSync());
        setPwExists(gs.hasPassword());
      } else if (detail.type === 'auto-push' || detail.type === 'push') {
        setLastSync(gs.getLastSync());
      }
    };
    window.addEventListener('sheets-sync', handler);
    return () => window.removeEventListener('sheets-sync', handler);
  }, []);

  const handleSave = () => {
    if (!url.trim()) {
      gs.setSheetUrl('');
      toast.success('Sincronización desactivada. Datos solo en este navegador.');
      setTestResult(null);
      onOpenChange(false);
      return;
    }
    gs.setSheetUrl(url.trim());
    toast.success('URL guardada. Probá la conexión.');
  };

  const handleTest = async () => {
    if (!url.trim()) {
      toast.error('Ingresá la URL primero');
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await gs.ping();
    setTestResult({
      ok: result.ok,
      message: result.ok
        ? `Conectado a Firebase`
        : (result.error || 'No se pudo conectar'),
    });
    setTesting(false);
  };

  const handleSyncNow = async () => {
    if (!gs.isConfigured()) {
      toast.error('Configurá la URL de Firebase primero');
      return;
    }
    setSyncing(true);
    const result = await gs.fullSync();
    setSyncing(false);
    setLastSync(gs.getLastSync());
    if (result.error) {
      toast.error(`Error: ${result.error}`);
    } else {
      toast.success(`Sincronizado: ${result.pulled} bajados, ${result.pushed} subidos`);
    }
  };

  const handleCreatePassword = () => {
    if (pwInput.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (pwInput !== pwConfirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    gs.setPassword(pwInput);
    setPwExists(true);
    setPwStep('idle');
    setPwInput('');
    setPwConfirm('');
    gs.schedulePush();
    toast.success('Contraseña creada y guardada');
  };

  const handleVerifyPassword = () => {
    if (gs.verifyPassword(pwInput)) {
      setPwStep('confirm_reset');
      setPwInput('');
    } else {
      toast.error('Contraseña incorrecta');
      setPwInput('');
    }
  };

  const handleFactoryReset = async () => {
    setResetting(true);
    try {
      for (const key of ALL_DATA_KEYS) {
        localStorage.removeItem(key);
      }

      // Also clear remote Firebase data
      if (gs.isConfigured()) {
        try {
          const fbUrl = gs.getSheetUrl();
          await fetch(`${fbUrl}/.json`, {
            method: 'DELETE',
          });
        } catch {
          // ignore - local is cleared anyway
        }
      }

      localStorage.setItem('trazabilidad_last_sync', new Date().toISOString());
      setPwStep('idle');
      toast.success('Sistema restablecido. Recargá la página.');
      onOpenChange(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
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

          {/* ========== FIREBASE SYNC SECTION ========== */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Database className="h-4 w-4 text-orange-500" />
              Sincronización con Firebase
            </h3>

            {/* Status */}
            <div className={`flex items-center gap-3 p-3 rounded-lg ${configured ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              {configured ? (
                <Cloud className="h-5 w-5 text-emerald-600" />
              ) : (
                <CloudOff className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-medium">{configured ? 'Conectado a Firebase' : 'No conectado'}</p>
                <p className="text-xs text-slate-500">
                  {configured
                    ? (lastSync ? `Ultima sync: ${new Date(lastSync).toLocaleString('es-UY')}` : 'Sincronización lista')
                    : 'Los datos se guardan solo en este navegador (se pierden al borrar cache)'}
                </p>
              </div>
            </div>

            {/* URL Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                URL de Firebase Realtime Database
              </label>
              <Input
                placeholder="https://tu-proyecto-default-rtdb.firebaseio.com"
                value={url}
                onChange={e => { setUrl(e.target.value); setTestResult(null); }}
                className="text-xs font-mono"
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              />
              <p className="text-[11px] text-slate-400">
                La URL de tu Realtime Database de Firebase (sin /.json al final)
              </p>
            </div>

            {/* Buttons row */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSave} className="flex-1">
                <Save className="h-3.5 w-3.5 mr-1.5" />Guardar URL
              </Button>
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !url.trim()}>
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

            {/* Sync button */}
            {configured && (
              <div className="space-y-2">
                <Button
                  size="sm"
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="w-full"
                  variant="outline"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar ahora (subir y bajar)'}
                </Button>
                <p className="text-[11px] text-slate-400">
                  Fusiona datos locales con Firebase. Tus datos locales tienen prioridad.
                </p>
              </div>
            )}

            {/* How it works */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <b>Como funciona:</b> Cada vez que editás datos, se guardan automáticamente en Firebase
                (3 segundos después de tu último cambio). Cuando abrís la app en otro PC o navegador,
                los datos se cargan automáticamente desde Firebase. Si borras el cache del navegador,
                no perdés nada porque está guardado en la nube.
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
                  importaciones y búsquedas recientes. También se borrará Firebase. <b>Esta acción es irreversible.</b>
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