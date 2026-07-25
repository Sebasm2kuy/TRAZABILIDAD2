import type { Shipment } from './types';
import { loadDepositos } from './dataRepository';

// Base path for static assets — must match next.config.ts basePath
const BASE = '/trazabilidad';

/** Resolve a data file path accounting for basePath deployment */
export function dataUrl(path: string): string {
  if (path.startsWith(BASE + '/')) return path;
  if (path.startsWith('/')) return BASE + path;
  return BASE + '/' + path;
}

// FIX: getCotes y fetchShipments ahora delegan en loadDepositos() que
// carga desde embarques.xlsx. Mantenidos por compat con componentes
// que todavía los importan (ShipmentTable, ProductoDestino, etc.).
// @deprecated usar loadDepositos() de dataRepository directamente.

export async function getCotes(): Promise<string[]> {
  const all = await loadDepositos();
  return [...new Set(all.map(s => s.nroCote).filter(Boolean) as string[])].sort();
}

export async function fetchAnalytics() {
  // FIX: calcular analytics desde loadDepositos() en vez de devolver
  // objeto vacío. ShipmentTable usa byPais/byProducto/byDestino para
  // poblar los filtros.
  const data = await loadDepositos();
  const byPaisMap = new Map<string, { pesoNeto: number; envios: number }>();
  const byProductoMap = new Map<string, { pesoNeto: number; envios: number }>();
  const byDestinoMap = new Map<string, { pesoNeto: number; envios: number }>();
  let total = 0, pesoNetoTotal = 0, envasesTotal = 0, pesoBrutoTotal = 0;
  let lastDate: string | null = null;
  const paises = new Set<string>();
  const productos = new Set<string>();

  for (const s of data) {
    total++;
    pesoNetoTotal += s.pesoNeto || 0;
    pesoBrutoTotal += s.pesoBruto || 0;
    envasesTotal += s.cantidadEnvases || 0;
    if (s.paisDestino) paises.add(s.paisDestino);
    if (s.denominacionMercaderia) productos.add(s.denominacionMercaderia);
    if (s.fechaTramite && (!lastDate || s.fechaTramite > lastDate)) lastDate = s.fechaTramite;

    if (s.paisDestino) {
      const cur = byPaisMap.get(s.paisDestino) || { pesoNeto: 0, envios: 0 };
      cur.pesoNeto += s.pesoNeto || 0; cur.envios += 1;
      byPaisMap.set(s.paisDestino, cur);
    }
    if (s.denominacionMercaderia) {
      const cur = byProductoMap.get(s.denominacionMercaderia) || { pesoNeto: 0, envios: 0 };
      cur.pesoNeto += s.pesoNeto || 0; cur.envios += 1;
      byProductoMap.set(s.denominacionMercaderia, cur);
    }
    if (s.nombreEstablecimientoDestino) {
      const cur = byDestinoMap.get(s.nombreEstablecimientoDestino) || { pesoNeto: 0, envios: 0 };
      cur.pesoNeto += s.pesoNeto || 0; cur.envios += 1;
      byDestinoMap.set(s.nombreEstablecimientoDestino, cur);
    }
  }

  return {
    total, pesoNetoTotal, pesoBrutoTotal, envasesTotal,
    uniquePaisCount: paises.size, uniqueProductoCount: productos.size,
    lastDate,
    monthlyData: [] as any[],
    byPais: [...byPaisMap.entries()].map(([pais, v]) => ({ pais, ...v })),
    byProducto: [...byProductoMap.entries()].map(([producto, v]) => ({ producto, ...v })),
    byDestino: [...byDestinoMap.entries()].map(([destino, v]) => ({ destino, ...v })),
  };
}

export async function fetchShipments(params: {
  page?: number;
  limit?: number;
  search?: string;
  pais?: string;
  producto?: string;
  destino?: string;
  tipo?: string;
  cote?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  let filtered = await loadDepositos();
  const { page = 1, limit = 20, search = '', pais, producto, destino, tipo, cote, fechaDesde, fechaHasta } = params;

  if (search) {
    const s = search.toLowerCase();
    const num = Number(search);
    filtered = filtered.filter(sh =>
      sh.nroTramite === num ||
      sh.nroCote?.toLowerCase().includes(s) ||
      sh.nombreEstablecimientoDestino?.toLowerCase().includes(s) ||
      sh.denominacionMercaderia?.toLowerCase().includes(s) ||
      sh.matriculaCamion?.toLowerCase().includes(s) ||
      sh.precinto1?.toLowerCase().includes(s)
    );
  }
  if (pais) filtered = filtered.filter(sh => sh.paisDestino?.includes(pais));
  if (producto) filtered = filtered.filter(sh => sh.denominacionMercaderia?.includes(producto));
  if (destino) filtered = filtered.filter(sh => sh.nombreEstablecimientoDestino?.includes(destino));
  if (tipo) filtered = filtered.filter(sh => (sh.tipo || '').toUpperCase() === String(tipo).toUpperCase());
  if (cote) filtered = filtered.filter(sh => sh.nroCote === cote);
  if (fechaDesde) filtered = filtered.filter(sh => sh.fechaTramite >= new Date(fechaDesde).toISOString());
  if (fechaHasta) filtered = filtered.filter(sh => sh.fechaTramite <= new Date(fechaHasta + 'T23:59:59').toISOString());

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const data = filtered.slice((page - 1) * limit, page * limit);

  return { data, total, page, limit, totalPages };
}
