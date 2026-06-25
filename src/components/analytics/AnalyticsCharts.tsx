'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Legend } from 'recharts';
import { dataUrl } from '@/lib/staticData';
import { fmt } from '@/lib/utils';
import type { Shipment, ExpRecord } from '@/lib/types';

// Same data loaders as Dashboard
async function loadAllDepositos(): Promise<Shipment[]> {
  const imported = localStorage.getItem('trazabilidad_dep_imported');
  let base: Shipment[];
  if (imported) { try { base = JSON.parse(imported); } catch { base = []; } }
  else { const r = await fetch(dataUrl('data/shipments.json')); base = await r.json(); }
  try { const raw = localStorage.getItem('trazabilidad_dep_new_records'); if (raw) { const nr: Shipment[] = JSON.parse(raw); const ids = new Set(base.map(s => s.id)); for (const n of nr) { if (!ids.has(n.id)) base.push(n); } } } catch { /* ignore */ }
  try { const raw = localStorage.getItem('trazabilidad_dep_edits'); if (raw) { const ed: Record<string, Partial<Shipment>> = JSON.parse(raw); base = base.map(s => ed[s.id] ? { ...s, ...ed[s.id] } : s); } } catch { /* ignore */ }
  try { const raw = localStorage.getItem('trazabilidad_dep_deleted'); if (raw) { const del: Set<string> = new Set(JSON.parse(raw)); base = base.filter(s => !del.has(s.id)); } } catch { /* ignore */ }
  return base;
}

async function loadAllExportaciones(): Promise<ExpRecord[]> {
  const imported = localStorage.getItem('trazabilidad_exp_imported');
  let base: ExpRecord[];
  if (imported) { try { base = JSON.parse(imported); } catch { base = []; } }
  else { const r = await fetch(dataUrl('data/exportaciones.json')); base = await r.json(); }
  try { const raw = localStorage.getItem('trazabilidad_new_records'); if (raw) { const nr: ExpRecord[] = JSON.parse(raw); const ids = new Set(base.map(e => e.id)); for (const n of nr) { if (!ids.has(n.id)) base.push(n); } } } catch { /* ignore */ }
  try { const raw = localStorage.getItem('trazabilidad_exp_edits'); if (raw) { const ed: Record<string, Partial<ExpRecord>> = JSON.parse(raw); base = base.map(e => ed[e.id] ? { ...e, ...ed[e.id] } : e); } } catch { /* ignore */ }
  try { const raw = localStorage.getItem('trazabilidad_exp_deleted'); if (raw) { const del: Set<string> = new Set(JSON.parse(raw)); base = base.filter(e => !del.has(e.id)); } } catch { /* ignore */ }
  return base;
}

export default function AnalyticsCharts() {
  const [depositos, setDepositos] = useState<Shipment[]>([]);
  const [exportaciones, setExportaciones] = useState<ExpRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAllDepositos(), loadAllExportaciones()])
      .then(([dep, exp]) => { setDepositos(dep); setExportaciones(exp); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const monthlyData = useMemo(() => {
    const all = [...depositos, ...exportaciones].filter(s => s.fechaTramite);
    const map = new Map<string, { month: string; pesoBruto: number; pesoNeto: number; envases: number; envios: number }>();
    for (const s of all) {
      const m = s.fechaTramite.substring(0, 7); // YYYY-MM
      if (!m || m.length !== 7) continue;
      const cur = map.get(m) || { month: m, pesoBruto: 0, pesoNeto: 0, envases: 0, envios: 0 };
      cur.pesoBruto += s.pesoBruto || 0;
      cur.pesoNeto += s.pesoNeto || 0;
      cur.envases += s.cantidadEnvases || 0;
      cur.envios += 1;
      map.set(m, cur);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({ ...m, label: m.month.substring(5) + '/' + m.month.substring(2, 4) }));
  }, [depositos, exportaciones]);

  const byProducto = useMemo(() => {
    const map = new Map<string, { producto: string; pesoNeto: number; envases: number; envios: number }>();
    for (const s of [...depositos, ...exportaciones]) {
      const p = s.denominacionMercaderia || 'Sin producto';
      const cur = map.get(p) || { producto: p, pesoNeto: 0, envases: 0, envios: 0 };
      cur.pesoNeto += s.pesoNeto || 0;
      cur.envases += s.cantidadEnvases || 0;
      cur.envios += 1;
      map.set(p, cur);
    }
    return [...map.values()].sort((a, b) => b.pesoNeto - a.pesoNeto).slice(0, 12);
  }, [depositos, exportaciones]);

  const byDestino = useMemo(() => {
    const map = new Map<string, { destino: string; pesoNeto: number; envases: number; envios: number }>();
    for (const s of [...depositos, ...exportaciones]) {
      const d = s.nombreEstablecimientoDestino || 'Sin destino';
      const cur = map.get(d) || { destino: d, pesoNeto: 0, envases: 0, envios: 0 };
      cur.pesoNeto += s.pesoNeto || 0;
      cur.envases += s.cantidadEnvases || 0;
      cur.envios += 1;
      map.set(d, cur);
    }
    return [...map.values()].sort((a, b) => b.pesoNeto - a.pesoNeto).slice(0, 10);
  }, [depositos, exportaciones]);

  if (loading) {
    return <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;
  }

  if (depositos.length === 0 && exportaciones.length === 0) {
    return (
      <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
        <h2 className="text-2xl font-bold text-slate-800">Analíticas</h2>
        <Card><CardContent className="p-8 text-center text-slate-400">
          <p>No hay datos disponibles. Importá datos desde la pestaña Importar / Exportar.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <h2 className="text-2xl font-bold text-slate-800">Analíticas</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Peso Bruto vs Neto — most useful chart */}
        {monthlyData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Peso Bruto vs Peso Neto Mensual</CardTitle></CardHeader>
            <CardContent className="h-80 relative">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip formatter={(v: any) => fmt(v) + ' kg'} />
                  <Legend />
                  <Bar dataKey="pesoBruto" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Peso Bruto" />
                  <Bar dataKey="pesoNeto" fill="#059669" radius={[4, 4, 0, 0]} name="Peso Neto" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* By Producto — useful for product breakdown */}
        {byProducto.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Distribución por Producto (kg)</CardTitle></CardHeader>
            <CardContent className="h-80 relative">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byProducto} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => fmt(v)} />
                  <YAxis type="category" dataKey="producto" width={200} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v: any) => fmt(v) + ' kg'} />
                  <Bar dataKey="pesoNeto" fill="#059669" radius={[0, 4, 4, 0]} name="Peso Neto (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* By Destino — useful for destination breakdown */}
        {byDestino.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Top Destinos por Peso Neto</CardTitle></CardHeader>
            <CardContent className="h-80 relative">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byDestino}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="destino" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip formatter={(v: any) => fmt(v) + ' kg'} />
                  <Bar dataKey="pesoNeto" fill="#10b981" radius={[4, 4, 0, 0]} name="Peso Neto (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
