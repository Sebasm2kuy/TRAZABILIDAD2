import type { Shipment } from './types';

export type BatchType = 'ingreso' | 'exportacion' | 'mixto';
export type RowType = Exclude<BatchType, 'mixto'>;

export interface ImportedBatch {
  id: string;
  name: string;
  date: string;
  count: number;
  tipo: BatchType;
  data: Shipment[];
}

export interface ImportResult {
  shipments: Shipment[];
  invalid: number;
  ambiguous: number;
  tipo: BatchType;
}

const value = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const candidate = row[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate).trim();
  }
  return '';
};

export function classifyImportRow(row: Record<string, unknown>): RowType | 'ambigua' {
  const explicit = value(row, ['Tipo', 'tipo']).toUpperCase();
  if (['INGRESO', 'DEPOSITO', 'DEPÓSITO'].includes(explicit)) return 'ingreso';
  if (['EXPORTACION', 'EXPORTACIÓN'].includes(explicit)) return 'exportacion';
  if (explicit) return 'ambigua';

  const pais = value(row, ['País', 'Pais', 'paisDestino', 'pais']);
  const destino = value(row, ['Destino', 'nombreEstablecimientoDestino', 'destino']);
  if (/CALIRAL/i.test(destino)) return 'ingreso';
  if (pais && destino) return 'exportacion';
  if (!pais && !destino) return 'ingreso';
  return 'ambigua';
}

export function mapImportRow(
  row: Record<string, unknown>,
  tipo: RowType,
  id: string,
  now: Date,
): Shipment | null {
  const nroTramite = Number(value(row, ['Nro. Trámite', 'nroTramite', 'Trámite', 'tramite'])) || 0;
  const nroCote = value(row, ['COTE', 'nroCote', 'cote']).toUpperCase();
  if (!nroTramite && !nroCote) return null;

  const fechaRaw = value(row, ['Fecha', 'fechaTramite', 'fecha']);
  let fechaTramite = now.toISOString();
  if (fechaRaw) {
    const parsed = new Date(fechaRaw + (fechaRaw.length === 10 ? 'T12:00:00' : ''));
    if (!Number.isNaN(parsed.getTime())) fechaTramite = parsed.toISOString();
  }

  const destino = value(row, ['Destino', 'nombreEstablecimientoDestino', 'destino']);
  return {
    id,
    nroTramite,
    fechaTramite,
    nroCote,
    nombreEstablecimientoDestino: destino || (tipo === 'ingreso' ? 'CALIRAL' : ''),
    paisDestino: value(row, ['País', 'Pais', 'paisDestino', 'pais']) || 'URUGUAY',
    denominacionMercaderia: value(row, ['Producto', 'denominacionMercaderia', 'producto']),
    corte: value(row, ['Corte', 'corte']),
    cantidadEnvases: Number(value(row, ['Envases', 'cantidadEnvases', 'envases'])) || null,
    pesoBruto: Number(value(row, ['Peso Bruto', 'pesoBruto'])) || null,
    pesoNeto: Number(value(row, ['Peso Neto', 'pesoNeto'])) || null,
    pallets: Number(value(row, ['Pallets', 'pallets'])) || null,
    tipoTransporte: value(row, ['Transporte', 'tipoTransporte']) || null,
    matriculaCamion: value(row, ['Matrícula', 'Matricula', 'matriculaCamion']) || null,
    precinto1: value(row, ['Precinto', 'precinto1', 'precinto']) || null,
    contenedorSerieNro: value(row, ['Contenedor', 'contenedorSerieNro']) || null,
    nroCertificadoSanitario: value(row, ['Cert. Sanitario', 'nroCertificadoSanitario']) || null,
    observaciones: value(row, ['Observaciones', 'observaciones']) || null,
    tipo: tipo === 'ingreso' ? 'INGRESO' : 'EXPORTACION',
  };
}

export function processImportRows(
  rows: Record<string, unknown>[],
  batchId: string,
  now = new Date(),
): ImportResult {
  const shipments: Shipment[] = [];
  let invalid = 0;
  let ambiguous = 0;

  rows.forEach((row, index) => {
    const hasTramite = Number(value(row, ['Nro. Trámite', 'nroTramite', 'Trámite', 'tramite'])) > 0;
    const hasCote = Boolean(value(row, ['COTE', 'nroCote', 'cote']));
    if (!hasTramite && !hasCote) {
      invalid++;
      return;
    }
    const tipo = classifyImportRow(row);
    if (tipo === 'ambigua') {
      ambiguous++;
      return;
    }
    const shipment = mapImportRow(row, tipo, `${batchId}-row-${index}`, now);
    if (shipment) shipments.push(shipment);
    else invalid++;
  });

  const types = new Set(shipments.map(record => record.tipo));
  const tipo: BatchType = types.size > 1 ? 'mixto' : types.has('EXPORTACION') ? 'exportacion' : 'ingreso';
  return { shipments, invalid, ambiguous, tipo };
}

export function prependBatch(batch: ImportedBatch, latestBatches: ImportedBatch[]): ImportedBatch[] {
  return [batch, ...latestBatches];
}

export function removeBatchCopies<T extends { id: string }>(records: T[], batches: ImportedBatch[]): T[] {
  const batchRecordIds = new Set(batches.flatMap(batch => (batch.data || []).map(record => record.id)));
  return records.filter(record => !batchRecordIds.has(record.id));
}
