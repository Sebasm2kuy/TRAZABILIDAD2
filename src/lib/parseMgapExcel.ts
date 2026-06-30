// ============================================================
// MGAP Excel Parser — Parses MGAP "Cargas y Embarques de Carne" XLSX files
// ============================================================
// These files have multiple sheets (Registros, Faena, Cláusulas, etc.)
// The Registros sheet has:
//   - Rows 0-15: filters/metadata
//   - Row 16: column headers
//   - Row 17+: data rows (one per product line, COTE can have multiple rows)
// ============================================================

import type { Shipment, ExpRecord } from './types';

export interface MgapParseResult {
  registros: Shipment[];
  faena: MgapFaena[];
  clausulas: MgapClausula[];
}

export interface MgapFaena {
  nroTramite: number;
  nroCote: string;
  fechaEmitidoCote: string;
  nombreEstablecimientoFaena: string;
  nroEstablecimientoFaena: string;
}

export interface MgapClausula {
  nroTramite: number;
  nroCote: string;
  fechaEmitidoCote: string;
  clausulaId: number;
  mercadoId: number;
  mercadoDescripcion: string;
  itemId: number;
  itemDescripcion: string;
  descripcion: string;
}

function cleanStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  // DD/MM/YYYY
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // ISO already
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.split('T')[0];
  return s;
}

// Map MGAP row to Shipment/ExpRecord
function mapRowToRecord(row: unknown[], isExport: boolean): Shipment | null {
  const tramite = cleanNum(row[0]);
  const cote = cleanStr(row[2]);
  if (!tramite || !cote) return null;

  const record: Shipment = {
    id: `${isExport ? 'exp' : 'ing'}_${tramite}_${cleanNum(row[41])}`, // Id Linea is col 41
    nroTramite: tramite,
    fechaTramite: parseDate(row[1]) || new Date().toISOString(),
    nroCote: cote,
    nombreMedicoVeterinario: cleanStr(row[3]),
    nombreEstablecimientoCertif: cleanStr(row[4]),
    nombreEstablecimientoProd: cleanStr(row[5]),
    nroEstablecimientoProd: cleanNum(row[6]) || null,
    fechaEmitidoCote: parseDate(row[7]),
    temperaturaC: cleanNum(row[8]) || null,
    tipoTransporte: cleanStr(row[9]),
    contenedorSerieNro: cleanStr(row[10]),
    matriculaCamion: cleanStr(row[12]),
    precinto1: cleanStr(row[13]),
    nombreEstablecimientoDestino: cleanStr(row[19]),
    tipoMovimiento: cleanStr(row[20]),
    observaciones: cleanStr(row[21]),
    paisDestino: cleanStr(row[23]),
    baja: cleanStr(row[33]),
    idLinea: cleanNum(row[41]) || null,
    codigoEnvase: cleanNum(row[42]) || null,
    denominacionMercaderia: cleanStr(row[43]),
    corte: cleanStr(row[44]),
    pallets: cleanNum(row[45]) || null,
    cantidadEnvases: cleanNum(row[46]),
    pesoBruto: cleanNum(row[47]),
    pesoNeto: cleanNum(row[48]),
    nroCertificadoSanitario: cleanStr(row[49]),
    shipping: cleanStr(row[50]),
    fechaInicioFaena: parseDate(row[53]),
    fechaFinFaena: parseDate(row[54]),
    fechaInicioProduccion: parseDate(row[55]),
    fechaFinProduccion: parseDate(row[56]),
    fechaInicioCongelacion: parseDate(row[57]),
    fechaFinCongelacion: parseDate(row[58]),
    proceso: cleanStr(row[60]),
    tipo: isExport ? 'EXPORTACION' : 'INGRESO',
  };

  if (isExport) {
    // Add export-specific fields
    (record as ExpRecord).papelSeguridad = cleanStr(row[61]);
    (record as ExpRecord).precinto2 = cleanStr(row[14]);
    (record as ExpRecord).precinto3 = cleanStr(row[15]);
    (record as ExpRecord).precinto4 = cleanStr(row[16]);
    (record as ExpRecord).precintoAgencia = cleanStr(row[17]);
    (record as ExpRecord).guiaINAC = cleanStr(row[18]);
    (record as ExpRecord).validezMercaderia = cleanStr(row[24]);
  }

  return record;
}

export async function parseMgapExcel(file: File, isExport: boolean): Promise<Shipment[]> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

  const sheetName = wb.SheetNames[0]; // 'Registros'
  if (!sheetName) throw new Error('El archivo no tiene hojas');
  const sheet = wb.Sheets[sheetName];

  // Convert to array of arrays
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Data starts at row 17 (index 16 is header)
  const registros: Shipment[] = [];
  for (let i = 16; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const record = mapRowToRecord(row, isExport);
    if (record) registros.push(record);
  }

  return registros;
}
