'use client';

// ============================================================
// FrigorieficosDepositos — Análisis de frigoríficos por categoría
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, Target, Globe, Package, Calendar, Building2,
  Warehouse, ArrowLeft, ChevronRight, Activity, Layers, Award,
} from 'lucide-react';
import { cn, fmt } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { loadEmbarquesRecords } from '@/lib/embarquesLoader';
import {
  getFrigorificosByCategoria,
} from '@/intelligence-engine/frigorificosData';
import {
  analyzeAllFrigorificos, rankDepositosCompetidores,
  type FrigorificoAnalysis, type BreakdownItem,
} from '@/intelligence-engine/frigorificosAnalyzer';
import type { MovRecord } from '@/intelligence-engine/types';

type CategoryType = 'A' | 'B';

interface Props {
  category: CategoryType;
  onBack?: () => void;
}

const CATEGORY_NAMES: Record<CategoryType, string> = {
  A: 'Frigoríficos con Depósitos Externos (Sin CALIRAL)',
  B: 'Frigoríficos con Depósitos Externos (Incluye CALIRAL)',
};

const CATEGORY_DESCRIPTIONS: Record<CategoryType, string> = {
  A: 'Frigoríficos que trabajan con depósitos externos pero NO utilizan CALIRAL. Análisis de competencia pura.',
  B: 'Frigoríficos que trabajan con depósitos externos, incluyendo los que usan CALIRAL y sus competidores.',
};

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6'];

interface PeriodPreset {
  id: string;
  label: string;
  start: string;
  end: string;
}

function getPeriodPresets(): PeriodPreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmtDate = (date: Date) => date.toISOString().split('T')[0];
  return [
    { id: 'todo', label: 'Todo el período', start: '', end: '' },
    { id: '2026', label: 'Año 2026', start: '2026-01-01', end: '2026-12-31' },
    { id: 'ult6', label: 'Últimos 6 meses', start: fmtDate(new Date(y, m - 5, 1)), end: fmtDate(now) },
    { id: 'ult3', label: 'Últimos 3 meses', start: fmtDate(new Date(y, m - 2, 1)), end: fmtDate(now) },
  ];
}

function fmtKg(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return fmt(n);
}

function fmtDate(d: string): string {
  if (!d) return '-';
  return d.substring(0, 10);
}

function truncateWithOtros(items: BreakdownItem[], maxItems = 8): BreakdownItem[] {
  if (items.length <= maxItems) return items;
  const top = items.slice(0, maxItems);
  const resto = items.slice(maxItems);
  const restoKg = resto.reduce((s, i) => s + i.kg, 0);
  const restoEnvases = resto.reduce((s, i) => s + i.envases, 0);
  const restoRegistros = resto.reduce((s, i) => s + i.registros, 0);
  const totalKg = items.reduce((s, i) => s + i.kg, 0);
  top.push({
    label: `Otros (${resto.length})`,
    kg: restoKg, envases: restoEnvases, registros: restoRegistros,
    pct: totalKg > 0 ? (restoKg / totalKg) * 100 : 0,
  });
  return top;
}

export function FrigorieficosDepositos({ category, onBack }: Props) {
  const [records, setRecords] = useState<MovRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadMsg, setLoadMsg] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedFrigorifico, setSelectedFrigorifico] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const loaded = await loadEmbarquesRecords(msg => setLoadMsg(msg));
      setRecords(loaded);
      setLoading(false);
    };
    load();
  }, []);

  const frigorificos = useMemo(() => getFrigorificosByCategoria(category), [category]);

  const analyses = useMemo(() => {
    if (!records.length) return new Map<string, FrigorificoAnalysis>();
    return analyzeAllFrigorificos(records, frigorificos, periodStart, periodEnd);
  }, [records, frigorificos, periodStart, periodEnd]);

  const depositosRanking = useMemo(() => {
    if (!analyses.size) return [];
    return rankDepositosCompetidores(analyses);
  }, [analyses]);

  const presets = getPeriodPresets();
  const categoryTitle = CATEGORY_NAMES[category];
  const categoryDesc = CATEGORY_DESCRIPTIONS[category];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-sm text-slate-500">{loadMsg || 'Cargando dataset embarques.xlsx…'}</p>
        </div>
      </div>
    );
  }

  if (!records.length) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <Warehouse className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Sin datos</h2>
          <p className="text-sm text-slate-500 mb-4">
            No se pudo cargar el archivo <code className="px-1 py-0.5 bg-slate-100 rounded">public/embarques.xlsx</code>.
            Verificá que el archivo exista y sea accesible.
          </p>
        </div>
      </div>
    );
  }

  if (selectedFrigorifico) {
    const analysis = analyses.get(selectedFrigorifico);
    if (!analysis) {
      return (
        <div className="p-6">
          <p className="text-sm text-slate-500">No se encontró análisis para {selectedFrigorifico}</p>
          <Button onClick={() => setSelectedFrigorifico(null)} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
        </div>
      );
    }
    return <FrigorificoDetalle analysis={analysis} onBack={() => setSelectedFrigorifico(null)} />;
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="px-8 pt-8 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Volver a categorías
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Building2 className="h-3.5 w-3.5" />
            <span>Clientes Estratégicos</span>
            <ChevronRight className="h-3 w-3" />
            <Badge variant={category === 'A' ? 'secondary' : 'default'}>
              {category === 'A' ? 'Categoría A' : 'Categoría B'}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-1">{categoryTitle}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{categoryDesc}</p>

          <div className="flex flex-wrap gap-2 mt-4">
            {presets.map(p => {
              const active = (periodStart === p.start && periodEnd === p.end);
              return (
                <Button
                  key={p.id}
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() => { setPeriodStart(p.start); setPeriodEnd(p.end); }}
                >
                  {p.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-8 pb-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Building2 className="h-3.5 w-3.5" /> Frigoríficos
            </div>
            <p className="text-2xl font-bold text-slate-800">{frigorificos.length}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Package className="h-3.5 w-3.5" /> Kg total
            </div>
            <p className="text-2xl font-bold text-emerald-700">
              {fmtKg([...analyses.values()].reduce((s, a) => s + a.kpis.totalKg, 0))} kg
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Warehouse className="h-3.5 w-3.5" /> Depósitos competidores
            </div>
            <p className="text-2xl font-bold text-blue-700">{depositosRanking.length}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Activity className="h-3.5 w-3.5" /> Registros
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {fmt([...analyses.values()].reduce((s, a) => s + a.kpis.totalRegistros, 0))}
            </p>
          </Card>
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="overflow-hidden">
            <div className="p-4 border-b bg-white">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Frigoríficos en esta categoría ({frigorificos.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hacé clic en un frigorífico para ver el detalle completo (cortes, destinos, depósitos, mensual).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Frigorífico</th>
                    <th className="px-4 py-2.5 text-left">Depósitos que usa</th>
                    <th className="px-4 py-2.5 text-right">Kg Neto</th>
                    <th className="px-4 py-2.5 text-right">Envases</th>
                    <th className="px-4 py-2.5 text-right">Registros</th>
                    <th className="px-4 py-2.5 text-left">Período activo</th>
                    <th className="px-4 py-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[...frigorificos]
                    .map(f => ({ f, a: analyses.get(f.name) }))
                    .sort((x, y) => (y.a?.kpis.totalKg || 0) - (x.a?.kpis.totalKg || 0))
                    .map(({ f, a }) => (
                      <tr
                        key={f.name}
                        className="border-b hover:bg-emerald-50/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedFrigorifico(f.name)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{f.name}</div>
                          {f.usaCaliral && (
                            <Badge className="mt-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Usa CALIRAL</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {f.depositos.map(d => (
                              <span
                                key={d}
                                className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded font-medium',
                                  d.toUpperCase() === 'CALIRAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                                )}
                              >{d}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">
                          {a ? fmtKg(a.kpis.totalKg) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {a ? fmt(a.kpis.totalEnvases) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-600">
                          {a ? fmt(a.kpis.totalRegistros) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {a ? `${fmtDate(a.kpis.fechaMin)} — ${fmtDate(a.kpis.fechaMax)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline">
                            Ver detalle <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          {depositosRanking.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b bg-white">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-600" />
                  Ranking de Depósitos Competidores
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cuánto movió cada depósito en total entre los frigoríficos de esta categoría.
                </p>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={Math.max(200, depositosRanking.length * 30)}>
                  <BarChart data={depositosRanking.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmtKg} />
                    <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => fmt(v) + ' kg'} />
                    <Bar dataKey="kg" radius={[0, 4, 4, 0]} name="Kg Neto">
                      {depositosRanking.slice(0, 15).map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.label.toUpperCase() === 'CALIRAL' ? '#10b981' : PALETTE[i % PALETTE.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FrigorificoDetalle({ analysis, onBack }: { analysis: FrigorificoAnalysis; onBack: () => void }) {
  const { frigorifico, kpis, byCorte, byPais, byDeposito, byTipoProducto, byTipoMovimiento, byMes } = analysis;
  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="px-8 pt-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-3">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la lista
          </Button>
          <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{frigorifico.name}</h1>
              <div className="flex flex-wrap gap-1 mt-2">
                {frigorifico.depositos.map(d => (
                  <span
                    key={d}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded font-medium',
                      d.toUpperCase() === 'CALIRAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                    )}
                  >{d}</span>
                ))}
              </div>
            </div>
            <Badge variant={frigorifico.categoria === 'B' ? 'default' : 'secondary'}>
              Categoría {frigorifico.categoria} {frigorifico.usaCaliral && '· Usa CALIRAL'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KpiCard label="Kg Neto" value={fmtKg(kpis.totalKg)} icon={Package} color="text-emerald-700" />
            <KpiCard label="Envases" value={fmt(kpis.totalEnvases)} icon={Package} color="text-blue-700" />
            <KpiCard label="Pallets" value={fmt(kpis.totalPallets)} icon={Layers} color="text-amber-700" />
            <KpiCard label="Registros" value={fmt(kpis.totalRegistros)} icon={Activity} color="text-slate-700" />
            <KpiCard label="Países" value={String(kpis.paisesUnicos)} icon={Globe} color="text-violet-700" />
            <KpiCard label="Cortes" value={String(kpis.cortesUnicos)} icon={Target} color="text-rose-700" />
          </div>

          <Card className="p-3 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-2 text-xs text-emerald-800">
              <Calendar className="h-4 w-4" />
              <span><b>Período activo:</b> {fmtDate(kpis.fechaMin)} — {fmtDate(kpis.fechaMax)}</span>
              <span className="text-emerald-500">·</span>
              <span><b>Peso bruto total:</b> {fmtKg(kpis.pesoBrutoTotal)} kg</span>
            </div>
          </Card>

          {byMes.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" /> Evolución Mensual (kg)
                </h2>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byMes.map(m => ({ month: m.month.substring(5) + '/' + m.month.substring(2, 4), kg: m.kg }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtKg} />
                    <Tooltip formatter={(v: any) => fmt(v) + ' kg'} />
                    <Bar dataKey="kg" fill="#10b981" radius={[4, 4, 0, 0]} name="Kg Neto" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownCard title="Cortes" icon={Target} iconColor="text-rose-600" items={byCorte.slice(0, 12)} showPct />
            <BreakdownCard title="Depósitos usados (certificadores)" icon={Warehouse} iconColor="text-blue-600" items={truncateWithOtros(byDeposito, 15)} showPct highlightLabel="CALIRAL" />
            <BreakdownCard title="Países destino" icon={Globe} iconColor="text-violet-600" items={truncateWithOtros(byPais, 15)} showPct />
            <BreakdownCard title="Tipo de producto" icon={Layers} iconColor="text-amber-600" items={truncateWithOtros(byTipoProducto, 10)} showPct />
          </div>

          {byTipoMovimiento.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-600" /> Tipo de movimiento
                </h2>
                {byTipoMovimiento.length > 10 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ {byTipoMovimiento.length} valores distintos detectados. Mostrando top 8 + Otros.
                  </p>
                )}
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={truncateWithOtros(byTipoMovimiento, 8)}
                      dataKey="kg"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(e: any) => `${e.label}: ${fmtKg(e.kg)} kg`}
                    >
                      {truncateWithOtros(byTipoMovimiento, 8).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v) + ' kg'} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wide mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className={cn('text-xl font-bold', color)}>{value}</p>
    </Card>
  );
}

function BreakdownCard({
  title, icon: Icon, iconColor, items, showPct, highlightLabel,
}: {
  title: string; icon: any; iconColor: string; items: BreakdownItem[]; showPct?: boolean; highlightLabel?: string;
}) {
  if (!items.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor)} /> {title}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">{items.length} elementos</p>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="text-slate-500 uppercase text-[10px]">
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-right">Kg</th>
              <th className="px-3 py-2 text-right">Envases</th>
              {showPct && <th className="px-3 py-2 text-right">%</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const isHighlight = highlightLabel && item.label.toUpperCase().includes(highlightLabel.toUpperCase());
              return (
                <tr key={i} className={cn('border-b hover:bg-slate-50', isHighlight && 'bg-emerald-50')}>
                  <td className="px-3 py-2 font-medium text-slate-700">
                    {item.label}
                    {isHighlight && <span className="ml-1 text-emerald-600">★</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700">{fmt(item.kg)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{fmt(item.envases)}</td>
                  {showPct && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', isHighlight ? 'bg-emerald-500' : 'bg-blue-400')}
                            style={{ width: `${Math.max(item.pct, 2)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 w-10 text-right">{item.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
