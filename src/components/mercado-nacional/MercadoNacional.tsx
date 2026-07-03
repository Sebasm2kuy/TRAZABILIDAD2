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
  BarChart3, PieChart, Activity
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
  const [view, setView] = useState<'dashboard' | 'search'>('dashboard');
  const [sortBy, setSortBy] = useState<'fecha' | 'cajas' | 'peso'>('fecha');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

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

          {/* Certificadores */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-base flex items-center gap-2"><Factory className="h-5 w-5 text-teal-600" /> Top Certificadores</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
    </div>
  );
}
