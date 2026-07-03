'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Globe, Search, X, TrendingUp, Package, Weight, Ship, Warehouse,
  Factory, MapPin, Calendar, ChevronRight, ChevronDown, Download, Upload, Loader2,
  BarChart3, PieChart, Activity, GitCompare
} from 'lucide-react';
import { dataUrl } from '@/lib/staticData';
import { fd, fmt } from '@/lib/utils';
import React from 'react';

interface Analytics {
  total: number;
  totalCajas: number;
  totalPeso: number;
  paises: [string, number][];
  productores: [string, number][];
  certificadores: [string, number][];
  tiposMov: [string, number][];
  denoms: [string, number][];
  meses: Record<string, number>;
}

interface MovRecord {
  t: string; f: string; c: string; cf: string; p: string; np: string;
  tm: string; pa: string; d: string; co: string; e: number; pb: number; pn: number;
}

const COLORS = ['#059669', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7'];

export default function MercadoNacional() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [records, setRecords] = useState<MovRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPais, setFilterPais] = useState('');
  const [filterProductor, setFilterProductor] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [view, setView] = useState<'dashboard' | 'search' | 'compare'>('dashboard');
  const [sortBy, setSortBy] = useState<'fecha' | 'cajas' | 'peso'>('fecha');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Compare mode state
  const [compareEst1, setCompareEst1] = useState('');
  const [compareEst2, setCompareEst2] = useState('');
  const [compareData, setCompareData] = useState<{ est1: any; est2: any } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Load analytics (small, fast)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(dataUrl('data/nacional_analytics.json'));
        if (r.ok) setAnalytics(await r.json());
      } catch (err) { console.error('Error loading analytics:', err); }
      setLoading(false);
    })();
  }, []);

  // Load full records (lazy, only when switching to search view)
  const loadRecords = useCallback(async () => {
    if (recordsLoaded) return;
    setLoadingRecords(true);
    try {
      const r = await fetch(dataUrl('data/nacional_mgmp.json'));
      if (r.ok) {
        const data = await r.json();
        setRecords(data);
        setRecordsLoaded(true);
      }
    } catch (err) { console.error('Error loading records:', err); }
    setLoadingRecords(false);
  }, [recordsLoaded]);

  useEffect(() => {
    if (view === 'search') loadRecords();
  }, [view, loadRecords]);

  // Compute stats for a single establishment from records
  const computeEstStats = useCallback((recs: MovRecord[], name: string) => {
    const paises: Record<string, number> = {};
    const denoms: Record<string, number> = {};
    const cortes: Record<string, number> = {};
    const tipos: Record<string, number> = {};
    const meses: Record<string, number> = {};
    let totalCajas = 0, totalPeso = 0;
    for (const r of recs) {
      if (r.pa) paises[r.pa] = (paises[r.pa] || 0) + 1;
      if (r.d) denoms[r.d] = (denoms[r.d] || 0) + 1;
      if (r.co) cortes[r.co] = (cortes[r.co] || 0) + 1;
      if (r.tm) tipos[r.tm] = (tipos[r.tm] || 0) + 1;
      if (r.f) { const m = r.f.substring(0, 7); meses[m] = (meses[m] || 0) + 1; }
      totalCajas += r.e || 0;
      totalPeso += r.pn || 0;
    }
    const sortEntries = (obj: Record<string, number>) => Object.entries(obj).sort(([,a],[,b]) => b - a);
    return {
      name, total: recs.length, totalCajas, totalPeso,
      paises: sortEntries(paises).slice(0, 10),
      denoms: sortEntries(denoms).slice(0, 10),
      cortes: sortEntries(cortes).slice(0, 10),
      tipos: sortEntries(tipos),
      meses: Object.entries(meses).sort(([a],[b]) => a.localeCompare(b)),
    };
  }, []);

  // Run comparison
  const runComparison = useCallback(async () => {
    if (!compareEst1 || !compareEst2 || compareEst1 === compareEst2) return;
    setCompareLoading(true);
    if (!recordsLoaded) await loadRecords();

    const recs1 = records.filter(r => r.p === compareEst1 || r.cf === compareEst1);
    const recs2 = records.filter(r => r.p === compareEst2 || r.cf === compareEst2);

    setCompareData({
      est1: computeEstStats(recs1, compareEst1),
      est2: computeEstStats(recs2, compareEst2),
    });
    setCompareLoading(false);
  }, [compareEst1, compareEst2, records, recordsLoaded, loadRecords, computeEstStats]);

  // Filter records
  const filteredRecords = useMemo(() => {
    if (!records.length) return [];
    let items = [...records];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(r =>
        r.t.includes(s) || r.c.toLowerCase().includes(s) ||
        r.p.toLowerCase().includes(s) || r.pa.toLowerCase().includes(s) ||
        r.d.toLowerCase().includes(s) || r.co.toLowerCase().includes(s) ||
        r.cf.toLowerCase().includes(s)
      );
    }
    if (filterPais) items = items.filter(r => r.pa === filterPais);
    if (filterProductor) items = items.filter(r => r.p === filterProductor);
    if (filterTipo) items = items.filter(r => r.tm === filterTipo);
    // Sort
    if (sortBy === 'cajas') items.sort((a, b) => b.e - a.e);
    else if (sortBy === 'peso') items.sort((a, b) => b.pn - a.pn);
    else items.sort((a, b) => (b.f || '').localeCompare(a.f || ''));
    return items;
  }, [records, search, filterPais, filterProductor, filterTipo, sortBy]);

  const totalPages = Math.ceil(filteredRecords.length / LIMIT);
  const pagedRecords = filteredRecords.slice((page - 1) * LIMIT, page * LIMIT);

  // Compute analytics from filtered records (dynamic charts)
  const filteredAnalytics = useMemo(() => {
    if (!filteredRecords.length) return null;
    const paises: Record<string, number> = {};
    const productores: Record<string, number> = {};
    const tipos: Record<string, number> = {};
    const denoms: Record<string, number> = {};
    const cortes: Record<string, number> = {};
    const meses: Record<string, number> = {};
    const certifs: Record<string, number> = {};
    let totalCajas = 0, totalPeso = 0;

    for (const r of filteredRecords) {
      if (r.pa) paises[r.pa] = (paises[r.pa] || 0) + 1;
      if (r.p) productores[r.p] = (productores[r.p] || 0) + 1;
      if (r.tm) tipos[r.tm] = (tipos[r.tm] || 0) + 1;
      if (r.d) denoms[r.d] = (denoms[r.d] || 0) + 1;
      if (r.co) cortes[r.co] = (cortes[r.co] || 0) + 1;
      if (r.cf) certifs[r.cf] = (certifs[r.cf] || 0) + 1;
      if (r.f) { const m = r.f.substring(0, 7); meses[m] = (meses[m] || 0) + 1; }
      totalCajas += r.e || 0;
      totalPeso += r.pn || 0;
    }

    const sortEntries = (obj: Record<string, number>) => Object.entries(obj).sort(([,a],[,b]) => b - a);

    return {
      total: filteredRecords.length,
      totalCajas, totalPeso,
      paises: sortEntries(paises).slice(0, 12),
      productores: sortEntries(productores).slice(0, 12),
      tipos: sortEntries(tipos),
      denoms: sortEntries(denoms).slice(0, 10),
      cortes: sortEntries(cortes).slice(0, 10),
      certifs: sortEntries(certifs).slice(0, 10),
      meses: Object.entries(meses).sort(([a],[b]) => a.localeCompare(b)),
    };
  }, [filteredRecords]);

  // Chart metric selector
  const [chartMetric, setChartMetric] = useState<'registros' | 'cajas' | 'peso'>('registros');
  const [chartDimension, setChartDimension] = useState<'paises' | 'productores' | 'denoms' | 'cortes' | 'tipos' | 'meses' | 'certifs'>('paises');

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterPais, filterProductor, filterTipo, sortBy]);

  // Chart helpers
  const maxPais = analytics ? Math.max(...analytics.paises.map(p => p[1])) : 1;
  const maxProductor = analytics ? Math.max(...analytics.productores.map(p => p[1])) : 1;
  const maxMes = analytics ? Math.max(...Object.values(analytics.meses)) : 1;
  const sortedMeses = analytics ? Object.entries(analytics.meses).sort(([a],[b]) => a.localeCompare(b)) : [];

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-2xl font-bold text-slate-800">Mercado Nacional</h2>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Globe className="h-7 w-7 text-emerald-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Mercado Nacional</h2>
            <p className="text-xs text-slate-500">Movimientos de carne de todos los frigoríficos de Uruguay</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'dashboard' ? 'default' : 'outline'} size="sm" onClick={() => setView('dashboard')}>
            <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <Button variant={view === 'search' ? 'default' : 'outline'} size="sm" onClick={() => setView('search')}>
            <Search className="h-4 w-4 mr-1" /> Buscar
          </Button>
          <Button variant={view === 'compare' ? 'default' : 'outline'} size="sm" onClick={() => setView('compare')}>
            <GitCompare className="h-4 w-4 mr-1" /> Comparar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-emerald-700"><Package className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Registros</span></div>
            <p className="text-xl font-bold text-emerald-700 mt-1">{analytics ? analytics.total.toLocaleString() : '—'}</p>
            <p className="text-[10px] text-slate-400">movimientos</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-blue-700"><Ship className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Exportaciones</span></div>
            <p className="text-xl font-bold text-blue-700 mt-1">{analytics?.tiposMov.find(t => t[0] === 'Exportación')?.[1].toLocaleString() || '—'}</p>
            <p className="text-[10px] text-slate-400">registros</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-amber-700"><Warehouse className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Cajas</span></div>
            <p className="text-xl font-bold text-amber-700 mt-1">{analytics ? fmt(analytics.totalCajas) : '—'}</p>
            <p className="text-[10px] text-slate-400">envases totales</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-violet-700"><Weight className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Peso Neto</span></div>
            <p className="text-xl font-bold text-violet-700 mt-1">{analytics ? fmt(analytics.totalPeso) : '—'}</p>
            <p className="text-[10px] text-slate-400">kg totales</p>
          </CardContent>
        </Card>
      </div>

      {view === 'dashboard' ? (
        <>
          {/* Top Países - Bar chart */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-5 w-5 text-emerald-600" /> Top 15 Países de Destino</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {analytics?.paises.slice(0, 15).map(([pais, count], i) => (
                  <div key={pais} className="flex items-center gap-3 group">
                    <span className="text-xs font-medium text-slate-700 w-40 truncate">{pais}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                      <div className={`h-full rounded-md transition-all duration-500 flex items-center px-2 ${i < COLORS.length ? `bg-[${COLORS[i]}]` : 'bg-emerald-500'}`}
                        style={{ width: `${(count / maxPais) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}>
                        <span className="text-[10px] font-semibold text-white whitespace-nowrap">{count.toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 w-10 text-right">{(count / (analytics?.total || 1) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Two columns: Productores + Tipos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-base flex items-center gap-2"><Factory className="h-5 w-5 text-blue-600" /> Top 15 Frigoríficos Productores</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-1.5">
                  {analytics?.productores.slice(0, 15).map(([prod, count], i) => (
                    <div key={prod} className="flex items-center gap-2 group cursor-pointer hover:bg-blue-50/50 -mx-2 px-2 py-0.5 rounded"
                      onClick={() => { setFilterProductor(prod); setView('search'); }}>
                      <span className="text-[10px] font-mono text-slate-400 w-6">{i + 1}</span>
                      <span className="text-xs font-medium text-slate-700 flex-1 truncate" title={prod}>{prod}</span>
                      <span className="text-xs text-slate-500 font-mono w-12 text-right">{count.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{(count / (analytics?.total || 1) * 100).toFixed(1)}%</span>
                      <div className="w-16 h-3 bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-sm" style={{ width: `${(count / maxProductor) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-5 w-5 text-amber-600" /> Tipos de Movimiento</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-2">
                  {analytics?.tiposMov.map(([tipo, count], i) => (
                    <div key={tipo} className="flex items-center gap-3 cursor-pointer hover:bg-amber-50/50 -mx-2 px-2 py-1 rounded"
                      onClick={() => { setFilterTipo(tipo); setView('search'); }}>
                      <span className="text-xs font-medium text-slate-700 flex-1">{tipo}</span>
                      <span className="text-xs text-slate-500 font-mono">{count.toLocaleString()}</span>
                      <div className="w-32 h-4 bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${(count / (analytics?.total || 1)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                      </div>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{(count / (analytics?.total || 1) * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Top Productos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analytics?.denoms.slice(0, 8).map(([denom, count]) => (
                      <Badge key={denom} variant="secondary" className="text-[10px] cursor-pointer hover:bg-emerald-100"
                        onClick={() => { setSearch(denom); setView('search'); }}>
                        {denom.substring(0, 30)}... ({count.toLocaleString()})
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly trend */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5 text-violet-600" /> Movimientos por Mes</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="flex items-end gap-2 h-40">
                {sortedMeses.map(([mes, count]) => (
                  <div key={mes} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9px] text-slate-400 group-hover:text-violet-600 transition-colors">{count.toLocaleString()}</span>
                    <div className="w-full bg-violet-500 group-hover:bg-violet-700 rounded-t transition-all duration-300"
                      style={{ height: `${(count / maxMes) * 120}px`, minHeight: '4px' }} title={`${mes}: ${count} registros`} />
                    <span className="text-[9px] text-slate-500">{mes.substring(5)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Certificadores - ALL */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base flex items-center gap-2"><Factory className="h-5 w-5 text-teal-600" /> Todos los Certificadores ({analytics?.certificadores.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {analytics?.certificadores.map(([cert, count], i) => (
                  <div key={cert} className="flex items-center gap-2 cursor-pointer hover:bg-teal-50/50 -mx-2 px-2 py-1 rounded"
                    onClick={() => { setSearch(cert); setView('search'); }}>
                    <span className="text-[10px] font-mono text-slate-400 w-6">{i + 1}</span>
                    <span className="text-xs font-medium text-slate-700 flex-1 truncate" title={cert}>{cert}</span>
                    <span className="text-xs text-slate-500 font-mono">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* SEARCH VIEW */
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="Buscar trámite, COTE, frigorífico, producto, país..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                  {search && <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer hover:text-red-500" onClick={() => setSearch('')} />}
                </div>
                {filterPais && <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterPais('')}>{filterPais} ×</Badge>}
                {filterProductor && <Badge variant="secondary" className="cursor-pointer max-w-[200px] truncate" onClick={() => setFilterProductor('')}>{filterProductor} ×</Badge>}
                {filterTipo && <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilterTipo('')}>{filterTipo} ×</Badge>}
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-xs border rounded px-2 py-1.5">
                  <option value="fecha">Ordenar por fecha</option>
                  <option value="cajas">Ordenar por cajas</option>
                  <option value="peso">Ordenar por peso</option>
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analytics?.paises.slice(0, 8).map(([pais]) => (
                  <button key={pais} className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${filterPais === pais ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} onClick={() => setFilterPais(filterPais === pais ? '' : pais)}>{pais}</button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic charts for filtered records */}
          {filteredAnalytics && !loadingRecords && filteredRecords.length > 0 && (
            <>
              {/* Filtered KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-l-4 border-l-emerald-500">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-emerald-700"><Package className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Registros</span></div>
                    <p className="text-lg font-bold text-emerald-700 mt-1">{filteredAnalytics.total.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-amber-700"><Package className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Cajas</span></div>
                    <p className="text-lg font-bold text-amber-700 mt-1">{filteredAnalytics.totalCajas.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-violet-500">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-violet-700"><Weight className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Kg Neto</span></div>
                    <p className="text-lg font-bold text-violet-700 mt-1">{filteredAnalytics.totalPeso.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-blue-700"><MapPin className="h-4 w-4" /><span className="text-[10px] uppercase font-semibold">Países</span></div>
                    <p className="text-lg font-bold text-blue-700 mt-1">{filteredAnalytics.paises.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Customizable chart */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-600" /> Gráfico Dinámico</CardTitle>
                    <div className="flex gap-2 flex-wrap">
                      <select value={chartDimension} onChange={e => setChartDimension(e.target.value as any)} className="text-xs border rounded px-2 py-1">
                        <option value="paises">Por País</option>
                        <option value="productores">Por Productor</option>
                        <option value="denoms">Por Producto</option>
                        <option value="cortes">Por Corte</option>
                        <option value="tipos">Por Tipo Mov.</option>
                        <option value="certifs">Por Certificador</option>
                        <option value="meses">Por Mes</option>
                      </select>
                      <select value={chartMetric} onChange={e => setChartMetric(e.target.value as any)} className="text-xs border rounded px-2 py-1">
                        <option value="registros">Registros</option>
                        <option value="cajas">Cajas</option>
                        <option value="peso">Kg Neto</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  {(() => {
                    const data = (filteredAnalytics as any)[chartDimension] as [string, number][];
                    if (!data || data.length === 0) return <p className="text-sm text-slate-400 text-center py-8">Sin datos para esta combinación</p>;
                    const maxVal = Math.max(...data.map(d => d[1]));
                    const isMeses = chartDimension === 'meses';
                    return (
                      <div className={isMeses ? "flex items-end gap-2 h-40" : "space-y-1.5"}>
                        {data.map(([label, count], i) => (
                          <div key={label} className={isMeses ? "flex-1 flex flex-col items-center gap-1 group" : "flex items-center gap-3 group"}>
                            <span className={isMeses ? "text-[9px] text-slate-400 group-hover:text-emerald-600" : "text-xs font-medium text-slate-700 w-40 truncate"} title={label}>
                              {isMeses ? label.substring(5) : label}
                            </span>
                            {isMeses ? (
                              <>
                                <span className="text-[9px] text-slate-400 group-hover:text-emerald-600">{count.toLocaleString()}</span>
                                <div className="w-full bg-emerald-500 group-hover:bg-emerald-700 rounded-t transition-all duration-300"
                                  style={{ height: `${(count / maxVal) * 120}px`, minHeight: '4px' }} title={`${label}: ${count}`} />
                              </>
                            ) : (
                              <>
                                <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden relative">
                                  <div className="h-full rounded-md transition-all duration-500 flex items-center px-2"
                                    style={{ width: `${(count / maxVal) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}>
                                    <span className="text-[10px] font-semibold text-white whitespace-nowrap">{count.toLocaleString()}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-400 w-10 text-right">{(count / filteredAnalytics.total * 100).toFixed(1)}%</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Mini charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2"><Ship className="h-4 w-4 text-blue-600" /> Países ({filteredAnalytics.paises.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-3">
                    <div className="flex flex-wrap gap-1.5">
                      {filteredAnalytics.paises.map(([pais, count]) => (
                        <button key={pais} className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${filterPais === pais ? 'bg-emerald-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          onClick={() => setFilterPais(filterPais === pais ? '' : pais)}>
                          {pais} ({count.toLocaleString()})
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-amber-600" /> Tipos de Movimiento</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-3">
                    <div className="space-y-1.5">
                      {filteredAnalytics.tipos.map(([tipo, count], i) => (
                        <div key={tipo} className="flex items-center gap-2 cursor-pointer hover:bg-amber-50/50 -mx-2 px-2 py-0.5 rounded"
                          onClick={() => setFilterTipo(filterTipo === tipo ? '' : tipo)}>
                          <span className="text-xs font-medium text-slate-700 flex-1">{tipo}</span>
                          <span className="text-xs text-slate-500 font-mono">{count.toLocaleString()}</span>
                          <div className="w-20 h-3 bg-slate-100 rounded-sm overflow-hidden">
                            <div className="h-full rounded-sm" style={{ width: `${(count / filteredAnalytics.total) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top productos y cortes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-emerald-600" /> Top Productos</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-3">
                    <div className="space-y-1">
                      {filteredAnalytics.denoms.map(([denom, count]) => (
                        <div key={denom} className="flex items-center gap-2 cursor-pointer hover:bg-emerald-50/50 -mx-2 px-2 py-0.5 rounded"
                          onClick={() => setSearch(denom)}>
                          <span className="text-xs text-slate-700 flex-1 truncate" title={denom}>{denom}</span>
                          <span className="text-xs text-slate-500 font-mono">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-violet-600" /> Top Cortes</CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-3">
                    <div className="space-y-1">
                      {filteredAnalytics.cortes.map(([corte, count]) => (
                        <div key={corte} className="flex items-center gap-2 cursor-pointer hover:bg-violet-50/50 -mx-2 px-2 py-0.5 rounded"
                          onClick={() => setSearch(corte)}>
                          <span className="text-xs text-slate-700 flex-1 truncate" title={corte}>{corte}</span>
                          <span className="text-xs text-slate-500 font-mono">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {loadingRecords ? 'Cargando 62.984 registros...' : `${filteredRecords.length.toLocaleString()} registros encontrados`}
            </p>
            {filteredRecords.length > 0 && <p className="text-xs text-slate-400">Página {page} de {totalPages}</p>}
          </div>

          {/* Table */}
          {loadingRecords ? (
            <Skeleton className="h-96" />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase sticky top-0">
                        <th className="px-3 py-2.5">Trámite</th>
                        <th className="px-3 py-2.5">Fecha</th>
                        <th className="px-3 py-2.5">COTE</th>
                        <th className="px-3 py-2.5 hidden md:table-cell">Productor</th>
                        <th className="px-3 py-2.5 hidden lg:table-cell">Producto</th>
                        <th className="px-3 py-2.5">País</th>
                        <th className="px-3 py-2.5">Tipo</th>
                        <th className="px-3 py-2.5 text-right">Cajas</th>
                        <th className="px-3 py-2.5 text-right hidden md:table-cell">Kg Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRecords.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-10 text-slate-400">No se encontraron registros</td></tr>
                      ) : pagedRecords.map((r, i) => (
                        <tr key={i} className="border-b hover:bg-blue-50/40">
                          <td className="px-3 py-2 text-xs font-mono">{r.t}</td>
                          <td className="px-3 py-2 text-xs">{r.f ? fd(r.f) : '-'}</td>
                          <td className="px-3 py-2 text-xs font-mono font-medium text-blue-700">{r.c || '-'}</td>
                          <td className="px-3 py-2 text-xs hidden md:table-cell max-w-[180px] truncate" title={r.p}>{r.p}</td>
                          <td className="px-3 py-2 text-xs hidden lg:table-cell max-w-[200px] truncate" title={r.d}>{r.d || '-'}</td>
                          <td className="px-3 py-2 text-xs">{r.pa || '-'}</td>
                          <td className="px-3 py-2"><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.tm === 'Exportación' ? 'bg-blue-100 text-blue-700' : r.tm === 'Depósito' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{r.tm}</span></td>
                          <td className="px-3 py-2 text-xs text-right font-mono">{r.e > 0 ? r.e.toLocaleString() : '-'}</td>
                          <td className="px-3 py-2 text-xs text-right font-mono hidden md:table-cell">{r.pn > 0 ? r.pn.toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-xs text-slate-500">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
            </div>
          )}
        </>
      )}

      {/* COMPARE VIEW */}
      {view === 'compare' && (
        <>
          {/* Selectors */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-slate-600">Establecimiento 1</label>
                  <select value={compareEst1} onChange={e => setCompareEst1(e.target.value)} className="w-full mt-1 text-sm border rounded px-2 py-1.5">
                    <option value="">Seleccionar...</option>
                    {analytics?.productores.map(([p]) => <option key={p} value={p}>{p}</option>)}
                    {analytics?.certificadores.map(([c]) => <option key={c} value={c}>{c} (certificador)</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-slate-600">Establecimiento 2</label>
                  <select value={compareEst2} onChange={e => setCompareEst2(e.target.value)} className="w-full mt-1 text-sm border rounded px-2 py-1.5">
                    <option value="">Seleccionar...</option>
                    {analytics?.productores.map(([p]) => <option key={p} value={p}>{p}</option>)}
                    {analytics?.certificadores.map(([c]) => <option key={c} value={c}>{c} (certificador)</option>)}
                  </select>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={runComparison} disabled={!compareEst1 || !compareEst2 || compareEst1 === compareEst2 || compareLoading}>
                  {compareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />} Comparar
                </Button>
              </div>
              {!recordsLoaded && <p className="text-[10px] text-amber-600 mt-2">⚠️ Se cargarán 62.984 registros para comparar (puede tardar unos segundos)</p>}
            </CardContent>
          </Card>

          {compareData && (
            <>
              {/* Comparison KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Registros', est1: compareData.est1.total, est2: compareData.est2.total, icon: Package, color: 'emerald' },
                  { label: 'Cajas', est1: compareData.est1.totalCajas, est2: compareData.est2.totalCajas, icon: Package, color: 'amber' },
                  { label: 'Kg Neto', est1: compareData.est1.totalPeso, est2: compareData.est2.totalPeso, icon: Weight, color: 'violet' },
                  { label: 'Países', est1: compareData.est1.paises.length, est2: compareData.est2.paises.length, icon: MapPin, color: 'blue' },
                ].map((kpi, i) => {
                  const max = Math.max(kpi.est1, kpi.est2) || 1;
                  const w1 = (kpi.est1 / max) * 100;
                  const w2 = (kpi.est2 / max) * 100;
                  const winner = kpi.est1 > kpi.est2 ? 1 : kpi.est2 > kpi.est1 ? 2 : 0;
                  return (
                    <Card key={i}>
                      <CardContent className="p-3">
                        <p className="text-[10px] uppercase font-semibold text-slate-500 mb-2">{kpi.label}</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-700 w-32 truncate" title={compareData.est1.name}>{compareData.est1.name.substring(0,20)}</span>
                            <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                              <div className="h-full bg-blue-500 rounded flex items-center px-2" style={{ width: `${w1}%` }}>
                                <span className="text-[9px] font-bold text-white">{kpi.est1.toLocaleString()}</span>
                              </div>
                            </div>
                            {winner === 1 && <span className="text-[10px] text-emerald-600 font-bold">▲</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-700 w-32 truncate" title={compareData.est2.name}>{compareData.est2.name.substring(0,20)}</span>
                            <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded flex items-center px-2" style={{ width: `${w2}%` }}>
                                <span className="text-[9px] font-bold text-white">{kpi.est2.toLocaleString()}</span>
                              </div>
                            </div>
                            {winner === 2 && <span className="text-[10px] text-emerald-600 font-bold">▲</span>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Side by side: Paises */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-blue-600" /> {compareData.est1.name} — Países</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-1">
                      {compareData.est1.paises.slice(0, 8).map(([pais, count]: [string, number], i: number) => {
                        const max = compareData.est1.paises[0]?.[1] || 1;
                        return <div key={pais} className="flex items-center gap-2"><span className="text-xs text-slate-700 w-32 truncate">{pais}</span><div className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden"><div className="h-full bg-blue-500 rounded-sm" style={{ width: `${(count/max)*100}%` }} /></div><span className="text-xs font-mono text-slate-500 w-10 text-right">{count}</span></div>;
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-600" /> {compareData.est2.name} — Países</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-1">
                      {compareData.est2.paises.slice(0, 8).map(([pais, count]: [string, number], i: number) => {
                        const max = compareData.est2.paises[0]?.[1] || 1;
                        return <div key={pais} className="flex items-center gap-2"><span className="text-xs text-slate-700 w-32 truncate">{pais}</span><div className="flex-1 h-4 bg-slate-100 rounded-sm overflow-hidden"><div className="h-full bg-emerald-500 rounded-sm" style={{ width: `${(count/max)*100}%` }} /></div><span className="text-xs font-mono text-slate-500 w-10 text-right">{count}</span></div>;
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side by side: Productos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-blue-600" /> {compareData.est1.name} — Productos</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-0.5">
                      {compareData.est1.denoms.slice(0, 8).map(([denom, count]: [string, number]) => <div key={denom} className="flex items-center gap-2"><span className="text-xs text-slate-700 flex-1 truncate" title={denom}>{denom}</span><span className="text-xs font-mono text-slate-500">{count}</span></div>)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-emerald-600" /> {compareData.est2.name} — Productos</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-0.5">
                      {compareData.est2.denoms.slice(0, 8).map(([denom, count]: [string, number]) => <div key={denom} className="flex items-center gap-2"><span className="text-xs text-slate-700 flex-1 truncate" title={denom}>{denom}</span><span className="text-xs font-mono text-slate-500">{count}</span></div>)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Side by side: Tipos de movimiento */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" /> {compareData.est1.name} — Tipos</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-1">
                      {compareData.est1.tipos.map(([tipo, count]: [string, number], i: number) => { const max = compareData.est1.total || 1; return <div key={tipo} className="flex items-center gap-2"><span className="text-xs text-slate-700 flex-1">{tipo}</span><div className="w-20 h-3 bg-slate-100 rounded-sm overflow-hidden"><div className="h-full bg-blue-500 rounded-sm" style={{ width: `${(count/max)*100}%` }} /></div><span className="text-xs font-mono text-slate-500">{count}</span></div>; })}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600" /> {compareData.est2.name} — Tipos</CardTitle></CardHeader>
                  <CardContent className="px-5 pb-4">
                    <div className="space-y-1">
                      {compareData.est2.tipos.map(([tipo, count]: [string, number], i: number) => { const max = compareData.est2.total || 1; return <div key={tipo} className="flex items-center gap-2"><span className="text-xs text-slate-700 flex-1">{tipo}</span><div className="w-20 h-3 bg-slate-100 rounded-sm overflow-hidden"><div className="h-full bg-emerald-500 rounded-sm" style={{ width: `${(count/max)*100}%` }} /></div><span className="text-xs font-mono text-slate-500">{count}</span></div>; })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly comparison overlay */}
              <Card>
                <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-violet-600" /> Comparación Mensual</CardTitle></CardHeader>
                <CardContent className="px-5 pb-4">
                  {(() => {
                    const allMeses = [...new Set([...compareData.est1.meses.map((m: [string, number]) => m[0]), ...compareData.est2.meses.map((m: [string, number]) => m[0])])].sort();
                    const maxVal = Math.max(...compareData.est1.meses.map((m: [string, number]) => m[1]), ...compareData.est2.meses.map((m: [string, number]) => m[1]), 1);
                    return (
                      <div className="flex items-end gap-1.5 h-32">
                        {allMeses.map(mes => {
                          const v1 = compareData.est1.meses.find((m: [string, number]) => m[0] === mes)?.[1] || 0;
                          const v2 = compareData.est2.meses.find((m: [string, number]) => m[0] === mes)?.[1] || 0;
                          return (
                            <div key={mes} className="flex-1 flex flex-col items-center gap-0.5 group">
                              <div className="flex items-end gap-0.5 h-24">
                                <div className="w-3 bg-blue-500 group-hover:bg-blue-700 rounded-t transition-all" style={{ height: `${(v1/maxVal)*80}px`, minHeight: '2px' }} title={`${compareData.est1.name}: ${v1}`} />
                                <div className="w-3 bg-emerald-500 group-hover:bg-emerald-700 rounded-t transition-all" style={{ height: `${(v2/maxVal)*80}px`, minHeight: '2px' }} title={`${compareData.est2.name}: ${v2}`} />
                              </div>
                              <span className="text-[8px] text-slate-500">{mes.substring(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="flex gap-4 mt-2 justify-center">
                    <span className="text-[10px] flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> {compareData.est1.name.substring(0, 25)}</span>
                    <span className="text-[10px] flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded"></span> {compareData.est2.name.substring(0, 25)}</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
