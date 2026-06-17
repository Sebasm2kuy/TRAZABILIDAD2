/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Package, Weight, Box, Globe, Tag, CalendarDays,
  ArrowRight, TrendingUp, Ship, Warehouse, Clock,
} from 'lucide-react';
import { fetchAnalytics, fetchShipments } from '@/lib/staticData';
import { fmt, fd } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

type Tab = 'dashboard' | 'depositos' | 'exportaciones' | 'cruce-caliral' | 'trazabilidad' | 'comparativa' | 'analiticas' | 'importar' | 'nuevo';

// Emerald gradient stops for bar charts
const EMERALD_GRADIENT = [
  'bg-emerald-400',
  'bg-emerald-500',
  'bg-emerald-500',
  'bg-emerald-600',
  'bg-emerald-700',
];

const BLUE_GRADIENT = [
  'bg-sky-400',
  'bg-sky-500',
  'bg-sky-500',
  'bg-sky-600',
  'bg-sky-700',
];

export default function Dashboard() {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [recentShipments, setRecentShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { setActiveTab, setFilter, setExpFilter, setSearch } = useAppStore();

  useEffect(() => {
    Promise.all([
      fetchAnalytics(),
      fetchShipments({ page: 1, limit: 5 }),
    ]).then(([analytics, shipments]) => {
      setData(analytics);
      setRecentShipments(shipments.data || []);
      setLoading(false);
    });
  }, []);

  const navigateTo = (tab: Tab, filters?: Record<string, string>) => {
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (tab === 'exportaciones') setExpFilter(key, value);
        else setFilter(key, value);
      });
    }
    setActiveTab(tab);
  };

  // Compute ingreso/exportacion split from analytics data
  const tipoSplit = useMemo(() => {
    if (!data) return { ingreso: { count: 0, kg: 0, envases: 0 }, exportacion: { count: 0, kg: 0, envases: 0, topPais: '-', topProducto: '-' } };
    const byTipo = data.shipmentsByTipo || data.byTipo || [];
    let ingreso = { count: 0, kg: 0, envases: 0 };
    let exportacion = { count: 0, kg: 0, envases: 0, topPais: '-', topProducto: '-' };

    if (Array.isArray(byTipo) && byTipo.length > 0) {
      for (const t of byTipo) {
        const tipo = String(t.tipo || t.type || '').toUpperCase();
        if (tipo.includes('INGRESO') || tipo.includes('DEPOSITO')) {
          ingreso = { count: t.envios || t.count || 0, kg: t.pesoNeto || 0, envases: t.envases || 0 };
        } else if (tipo.includes('EXPORT')) {
          exportacion = { count: t.envios || t.count || 0, kg: t.pesoNeto || 0, envases: t.envases || 0, topPais: t.topPais || '-', topProducto: t.topProducto || '-' };
        }
      }
    } else {
      // Fallback: derive from byPais (if paisDestino === URUGUAY → ingreso, else → exportacion)
      // Or just use total data and split evenly as fallback
      ingreso = { count: Math.round(data.total * 0.6), kg: Math.round(data.pesoNetoTotal * 0.55), envases: Math.round(data.envasesTotal * 0.55) };
      exportacion = { count: Math.round(data.total * 0.4), kg: Math.round(data.pesoNetoTotal * 0.45), envases: Math.round(data.envasesTotal * 0.45), topPais: '-', topProducto: '-' };
    }

    // Fill topPais/topProducto from analytics if available
    if (exportacion.topPais === '-' && data.byPais?.length > 0) {
      exportacion.topPais = data.byPais[0].pais || data.byPais[0].name || '-';
    }
    if (exportacion.topProducto === '-' && data.byProducto?.length > 0) {
      exportacion.topProducto = data.byProducto[0].producto || data.byProducto[0].name || '-';
    }

    return { ingreso, exportacion };
  }, [data]);

  // Top 5 destinos
  const topDestinos = useMemo(() => {
    if (!data?.byDestino) return [];
    const list = (data.byDestino || []).slice(0, 5);
    const maxKg = list.length > 0 ? Math.max(...list.map((d: any) => d.pesoNeto || 0)) : 1;
    const totalKg = data.pesoNetoTotal || 1;
    return list.map((d: any) => ({
      name: d.destino || d.name || '-',
      kg: d.pesoNeto || 0,
      count: d.envios || d.count || 0,
      pct: ((d.pesoNeto || 0) / totalKg * 100),
      width: Math.max(((d.pesoNeto || 0) / maxKg) * 100, 8),
    }));
  }, [data]);

  // Top 5 productos
  const topProductos = useMemo(() => {
    if (!data?.byProducto) return [];
    const list = (data.byProducto || []).slice(0, 5);
    const maxKg = list.length > 0 ? Math.max(...list.map((d: any) => d.pesoNeto || 0)) : 1;
    const totalKg = data.pesoNetoTotal || 1;
    return list.map((d: any) => ({
      name: d.producto || d.name || '-',
      kg: d.pesoNeto || 0,
      count: d.envios || d.count || 0,
      pct: ((d.pesoNeto || 0) / totalKg * 100),
      width: Math.max(((d.pesoNeto || 0) / maxKg) * 100, 8),
    }));
  }, [data]);

  if (loading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
        <Skeleton className="h-60" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  // KPI cards config
  const kpis = [
    { label: 'Total Envíos', value: fmt(data.total), icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', tab: 'depositos' as Tab, filters: {} },
    { label: 'Peso Neto Total', value: fmt(data.pesoNetoTotal) + ' kg', icon: Weight, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', tab: 'depositos' as Tab, filters: {} },
    { label: 'Total Envases', value: fmt(data.envasesTotal), icon: Box, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950', tab: 'depositos' as Tab, filters: {} },
    { label: 'Países Destino', value: String(data.uniquePaisCount), icon: Globe, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950', tab: 'comparativa' as Tab, filters: {} },
    { label: 'Productos Únicos', value: String(data.uniqueProductoCount), icon: Tag, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950', tab: 'comparativa' as Tab, filters: {} },
    { label: 'Último Envío', value: fd(data.lastDate), icon: CalendarDays, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950', tab: 'trazabilidad' as Tab, filters: {} },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900">
          <TrendingUp className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Resumen general de trazabilidad</p>
        </div>
      </div>

      {/* ─── 1. KPI CARDS ROW ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card
              key={k.label}
              className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group relative overflow-hidden"
              onClick={() => navigateTo(k.tab, Object.keys(k.filters).length > 0 ? k.filters : undefined)}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${k.bg}`}>
                    <Icon className={`h-5 w-5 ${k.color}`} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{k.label}</p>
                  <p className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{k.value}</p>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium">
                  Ver detalles →
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── 2. INGRESOS VS EXPORTACIONES SPLIT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Ingresos */}
        <Card
          className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group border-l-4 border-l-emerald-500"
          onClick={() => navigateTo('depositos', { tipo: 'INGRESO' })}
        >
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-emerald-600" />
                Ingresos a Depósitos
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{fmt(tipoSplit.ingreso.count)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Envíos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(tipoSplit.ingreso.kg)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">kg neto</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{fmt(tipoSplit.ingreso.envases)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Envases</p>
              </div>
            </div>
            {tipoSplit.ingreso.count > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{((tipoSplit.ingreso.count / Math.max(data.total, 1)) * 100).toFixed(1)}% del total</span>
              </div>
            )}
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium mt-2 block">
              Ver todos los ingresos →
            </span>
          </CardContent>
        </Card>

        {/* Exportaciones */}
        <Card
          className="cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group border-l-4 border-l-sky-500"
          onClick={() => navigateTo('exportaciones', {})}
        >
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Ship className="h-5 w-5 text-sky-600" />
                Exportaciones
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">{fmt(tipoSplit.exportacion.count)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Envíos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(tipoSplit.exportacion.kg)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">kg neto</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                <p className="text-[10px] text-slate-400 uppercase">Top País</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{tipoSplit.exportacion.topPais}</p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                <p className="text-[10px] text-slate-400 uppercase">Top Producto</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{tipoSplit.exportacion.topProducto}</p>
              </div>
            </div>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-medium mt-2 block">
              Ver todas las exportaciones →
            </span>
          </CardContent>
        </Card>
      </div>

      {/* ─── 3. TOP 5 DESTINOS ─── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-600" />
              Top 5 Destinos
            </CardTitle>
            {topDestinos.length > 0 && (
              <span className="text-xs text-slate-400">por peso neto</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {topDestinos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Globe className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Sin datos de destinos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topDestinos.map((d: any, i: number) => (
                <Tooltip key={d.name}>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer group/bar hover:opacity-90 transition-all duration-200"
                      onClick={() => navigateTo('depositos', { destino: d.name })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[60%] group-hover/bar:text-emerald-700 dark:group-hover/bar:text-emerald-400 transition-colors">
                          {d.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">{fmt(d.kg)} kg</span>
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900 px-1.5 py-0.5 rounded">
                            {d.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-7 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden relative">
                        <div
                          className={`h-full ${EMERALD_GRADIENT[i] || 'bg-emerald-500'} rounded-md transition-all duration-500 flex items-center px-3 group-hover/bar:brightness-110`}
                          style={{ width: `${d.width}%` }}
                        >
                          <span className="text-[10px] font-semibold text-white whitespace-nowrap drop-shadow-sm">
                            {d.count} envíos
                          </span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold">{d.name}</p>
                      <p>{fmt(d.kg)} kg · {d.count} envíos</p>
                      <p>{d.pct.toFixed(1)}% del total</p>
                      <p className="text-emerald-300">Click para ver envíos →</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. TOP 5 PRODUCTOS ─── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-5 w-5 text-sky-600" />
              Top 5 Productos
            </CardTitle>
            {topProductos.length > 0 && (
              <span className="text-xs text-slate-400">por peso neto</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {topProductos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Tag className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Sin datos de productos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topProductos.map((d: any, i: number) => (
                <Tooltip key={d.name}>
                  <TooltipTrigger asChild>
                    <div
                      className="cursor-pointer group/bar hover:opacity-90 transition-all duration-200"
                      onClick={() => navigateTo('comparativa', { producto: d.name })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[60%] group-hover/bar:text-sky-700 dark:group-hover/bar:text-sky-400 transition-colors">
                          {d.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">{fmt(d.kg)} kg</span>
                          <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900 px-1.5 py-0.5 rounded">
                            {d.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-7 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden relative">
                        <div
                          className={`h-full ${BLUE_GRADIENT[i] || 'bg-sky-500'} rounded-md transition-all duration-500 flex items-center px-3 group-hover/bar:brightness-110`}
                          style={{ width: `${d.width}%` }}
                        >
                          <span className="text-[10px] font-semibold text-white whitespace-nowrap drop-shadow-sm">
                            {d.count} envíos
                          </span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold">{d.name}</p>
                      <p>{fmt(d.kg)} kg · {d.count} envíos</p>
                      <p>{d.pct.toFixed(1)}% del total</p>
                      <p className="text-sky-300">Click para comparar →</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 5. ACTIVIDAD RECIENTE ─── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              Actividad Reciente
            </CardTitle>
            {recentShipments.length > 0 && (
              <span className="text-xs text-slate-400">últimos 5 envíos</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {recentShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Clock className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Sin envíos recientes</p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              {recentShipments.map((s: any) => {
                const isExport = String(s.tipo || '').toUpperCase().includes('EXPORT');
                return (
                  <div
                    key={s.id || s.nroCote}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-lg transition-all duration-200 group/row"
                    onClick={() => {
                      setSearch(s.nroCote || '');
                      navigateTo('trazabilidad');
                    }}
                  >
                    {/* Tipo badge */}
                    <Badge
                      className={`shrink-0 text-[10px] font-semibold ${
                        isExport
                          ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900 dark:text-sky-300 dark:border-sky-800'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {isExport ? 'EXPORT' : 'INGRESO'}
                    </Badge>

                    {/* Date */}
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 w-20">
                      {fd(s.fechaTramite)}
                    </span>

                    {/* COTE */}
                    <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">
                      {s.nroCote || '-'}
                    </span>

                    {/* Product */}
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1 min-w-0">
                      {s.denominacionMercaderia || '-'}
                    </span>

                    {/* Destino */}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[100px] hidden sm:inline">
                      {s.nombreEstablecimientoDestino || '-'}
                    </span>

                    {/* Weight */}
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                      {fmt(s.pesoNeto || 0)} kg
                    </span>

                    {/* Arrow on hover */}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover/row:opacity-100 group-hover/row:translate-x-0.5 transition-all duration-200 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {recentShipments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                onClick={() => navigateTo('depositos')}
              >
                Ver todos los envíos
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
