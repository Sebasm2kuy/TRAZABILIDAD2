// ============================================================
// EMBARQUES LOADER — Carga perezosa y cacheada de public/embarques.xlsx
// ------------------------------------------------------------
// Reemplaza al Firebase Realtime Database como fuente de datos
// del mercado nacional. Lee el Excel directamente en el browser
// con xlsx (SheetJS), lo parsea a MovRecord[] y lo cachea en memoria.
//
// El Excel tiene 52,940 registros con headers en la fila 1
// (formato simplificado del MGAP — 34 columnas en vez de 60).
// ============================================================

import type { MovRecord } from '@/intelligence-engine/types';
import type { Shipment, ExpRecord } from '@/lib/types';
import { dataUrl } from '@/lib/staticData';

let cache: MovRecord[] | null = null;
let loadingPromise: Promise<MovRecord[]> | null = null;

const CONGEL_KEYWORDS = ['CONGEL', 'FROZEN', 'CONG'];
const FRESCO_KEYWORDS = ['FRESC', 'REFRIG', 'CHILLED', 'CHILL', 'FRESH'];

function cleanStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().replace(/\s+/g, ' ');
}

function cleanNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return v.toISOString().split('T')[0];
  }
  if (typeof v === 'number' && v > 25000 && v < 60000) {
    // Excel serial date
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const s = String(v).trim();
  // DD/MM/YYYY (uruguayo — fix bug #10)
  const m = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    let [_, aStr, bStr, y] = m;
    let a = parseInt(aStr, 10);  // día
    let b = parseInt(bStr, 10);  // mes
    if (y.length === 2) y = '20' + y;
    if (a > 12 && b <= 12) { [a, b] = [b, a]; }  // input era MM/DD
    const d = new Date(parseInt(y), b - 1, a);
    if (!isNaN(d.getTime()) && d.getMonth() === b - 1 && d.getDate() === a) {
      return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
    return '';
  }
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.split('T')[0];
  return s;
}

function deriveTpd(denominacion: string): string {
  const upper = (denominacion || '').toUpperCase();
  if (CONGEL_KEYWORDS.some(k => upper.includes(k))) return 'Congelado';
  if (FRESCO_KEYWORDS.some(k => upper.includes(k))) return 'Fresco';
  return '';
}

/**
 * Parsea el Excel embarques.xlsx (formato Array of arrays) a MovRecord[].
 * Espera headers en la fila 1, datos desde la fila 2.
 */
export function parseEmbarquesRows(rows: unknown[][]): MovRecord[] {
  if (!rows.length) return [];

  // Mapear headers a índices — el Excel tiene 34 columnas con nombres conocidos
  const headers = (rows[0] || []).map(h => cleanStr(h).toLowerCase());
  const colIdx: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    colIdx[headers[i]] = i;
  }

  // Helper: buscar valor por nombre canónico o alias
  const get = (row: unknown[], ...names: string[]): unknown => {
    for (const n of names) {
      const idx = colIdx[n.toLowerCase()];
      if (idx !== undefined && row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
        return row[idx];
      }
    }
    return '';
  };

  const records: MovRecord[] = [];
  // Datos empiezan en fila 2 (índice 1)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;

    const tramite = cleanNum(get(row, 'Nro. Trámite', 'Nro. Tramite'));
    const cote = cleanStr(get(row, 'Nro. de C.O.T.E.', 'Nro. de C.O.T.E', 'COTE'));
    if (!tramite && !cote) continue;

    const cf = cleanStr(get(row, 'Nombre del Establecimiento Certificador'));
    const p = cleanStr(get(row, 'Nombre Establecimiento Productor'));
    const ed = cleanStr(get(row, 'Nombre Establecimiento Destino'));
    const tmRaw = cleanStr(get(row, 'Tipo de Movimiento'));
    const tmUpper = tmRaw.toUpperCase();
    const isExport = tmUpper.includes('EXPORT');
    const isDep = tmUpper.includes('DEP') || tmUpper.includes('INGRESO');
    const denom = cleanStr(get(row, 'Denominación de Mercadería', 'Denominacion de Mercadería'));
    const tpd = deriveTpd(denom);

    const rec: MovRecord = {
      tramite,
      t: isExport ? 'EXPORTACION' : 'INGRESO',
      f: parseDate(get(row, 'Fecha del Trámite', 'Fecha del Tramite')),
      c: cote,
      cf,
      p,
      np: cleanStr(get(row, 'Nro. Establecimiento Productor')),
      ed,
      tm: tmRaw,
      pa: cleanStr(get(row, 'País de Destino', 'Pais de Destino')),
      d: denom,
      co: cleanStr(get(row, 'Corte')),
      pa2: cleanNum(get(row, 'Pallets')),
      e: cleanNum(get(row, 'Cantidad de Envases')),
      pb: cleanNum(get(row, 'Peso Bruto')),
      pn: cleanNum(get(row, 'Peso Neto')),
      tt: cleanStr(get(row, 'Tipo de Transporte')),
      sh: '',
      tpd,
      isd: isDep,
    };
    records.push(rec);
  }
  return records;
}

/**
 * Carga el Excel public/embarques.xlsx y devuelve MovRecord[].
 * Cachea el resultado en memoria para llamadas subsiguientes.
 */
export async function loadEmbarquesRecords(
  onProgress?: (msg: string) => void,
): Promise<MovRecord[]> {
  if (cache) return cache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      onProgress?.('Descargando embarques.xlsx…');
      const resp = await fetch(dataUrl('embarques.xlsx'));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuffer = await resp.arrayBuffer();

      onProgress?.('Parseando Excel…');
      const XLSX = await import('xlsx');
      const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('El archivo no tiene hojas');
      const sheet = wb.Sheets[sheetName];

      // sheet_to_json con header:1 → array de arrays, raw:true para mantener números
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

      onProgress?.(`Procesando ${rows.length.toLocaleString('es-UY')} filas…`);
      // Ceder al event loop para no bloquear UI
      await new Promise(r => setTimeout(r, 0));

      const records = parseEmbarquesRows(rows);
      cache = records;

      onProgress?.(`${records.length.toLocaleString('es-UY')} registros cargados`);
      return records;
    } catch (e) {
      console.warn('[embarques-loader] carga falló:', e);
      cache = [];
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/** Devuelve los registros cacheados (null si no se cargaron todavía). */
export function getCachedEmbarquesRecords(): MovRecord[] | null {
  return cache;
}

/** Limpia el cache (para forzar recarga). */
export function clearEmbarquesCache(): void {
  cache = null;
  loadingPromise = null;
}

/** Estadísticas del cache para diagnóstico. */
export function getEmbarquesCacheStats(): { totalRecords: number; loaded: boolean } {
  return {
    totalRecords: cache?.length ?? 0,
    loaded: cache !== null,
  };
}

// ============================================================
// Conversión MovRecord → Shipment / ExpRecord
// ------------------------------------------------------------
// Permite que dataRepository.loadDepositos() / loadExportaciones()
// sirvan datos del Excel a todos los componentes que esperan esos
// tipos (Dashboard, ShipmentTable, ExportacionesTable, etc.).
// ============================================================

/** Convierte un MovRecord del Excel a un Shipment (formato de depósito). */
function movRecordToShipment(r: MovRecord, idx: number): Shipment {
  const tramite = r.tramite || 0;
  return {
    id: `emb-${idx}-${tramite || r.c || idx}`,
    nroTramite: tramite,
    fechaTramite: r.f || '',
    nroCote: r.c || '',
    nombreEstablecimientoCertif: r.cf || null,
    nombreEstablecimientoProd: r.p || null,
    nroEstablecimientoProd: parseInt((r.np || '').replace(/[^0-9]/g, '')) || null,
    tipoTransporte: r.tt || null,
    nombreEstablecimientoDestino: r.ed || '',
    tipoMovimiento: r.tm || null,
    observaciones: null,
    paisDestino: r.pa || '',
    denominacionMercaderia: r.d || '',
    corte: r.co || '',
    pallets: r.pa2 || null,
    cantidadEnvases: r.e || null,
    pesoBruto: r.pb || null,
    pesoNeto: r.pn || null,
    tipo: r.t === 'EXPORTACION' ? 'EXPORTACION' : 'DEPOSITO',
  };
}

/** Convierte un MovRecord del Excel a un ExpRecord (formato de exportación). */
function movRecordToExpRecord(r: MovRecord, idx: number): ExpRecord {
  return {
    ...movRecordToShipment(r, idx),
    tipo: 'EXPORTACION',
  };
}

/**
 * Devuelve todos los registros del Excel como Shipment[] (depósitos +
 * recargas). Filtra solo los que son tipo Depósito o Recarga.
 * Cachea el resultado para llamadas subsiguientes.
 */
let depositosCache: Shipment[] | null = null;
export async function loadEmbarquesAsDepositos(): Promise<Shipment[]> {
  if (depositosCache) return depositosCache;
  const records = await loadEmbarquesRecords();
  depositosCache = records
    .filter(r => {
      const tm = (r.tm || '').toUpperCase();
      return tm.includes('DEP') || tm.includes('RECARGA') || tm.includes('INGRESO');
    })
    .map((r, i) => movRecordToShipment(r, i));
  return depositosCache;
}

/**
 * Devuelve todos los registros del Excel como ExpRecord[] (exportaciones).
 * Filtra solo los que son tipo Exportación.
 * Cachea el resultado para llamadas subsiguientes.
 */
let exportacionesCache: ExpRecord[] | null = null;
export async function loadEmbarquesAsExportaciones(): Promise<ExpRecord[]> {
  if (exportacionesCache) return exportacionesCache;
  const records = await loadEmbarquesRecords();
  exportacionesCache = records
    .filter(r => (r.tm || '').toUpperCase().includes('EXPORT'))
    .map((r, i) => movRecordToExpRecord(r, i));
  return exportacionesCache;
}

/** Limpia todos los caches (para forzar recarga). */
export function clearAllEmbarquesCaches(): void {
  clearEmbarquesCache();
  depositosCache = null;
  exportacionesCache = null;
}
