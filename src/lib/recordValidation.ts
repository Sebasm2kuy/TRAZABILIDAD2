import type { Shipment } from './types';

const numericFields: Array<{ key: keyof Shipment; label: string; integer?: boolean }> = [
  { key: 'nroTramite', label: 'Nro. Trámite', integer: true },
  { key: 'cantidadEnvases', label: 'Cantidad de envases', integer: true },
  { key: 'pallets', label: 'Pallets', integer: true },
  { key: 'pesoBruto', label: 'Peso bruto' },
  { key: 'pesoNeto', label: 'Peso neto' },
];

const normalized = (value: unknown) => String(value ?? '').trim().toUpperCase();

export function recordIdentity(record: Partial<Shipment>): string | null {
  const tramite = Number(record.nroTramite) || 0;
  const cote = normalized(record.nroCote);
  if (!tramite && !cote) return null;
  return [tramite, cote, normalized(record.denominacionMercaderia), normalized(record.corte)].join('|');
}

export function validateShipmentRecord(record: Shipment, existing: Shipment[] = []): string[] {
  const errors: string[] = [];
  if (!recordIdentity(record)) errors.push('Ingresá un número de trámite o un COTE.');

  for (const { key, label, integer } of numericFields) {
    const raw = record[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) errors.push(`${label} debe ser un número igual o mayor que cero.`);
    else if (integer && !Number.isInteger(number)) errors.push(`${label} debe ser un número entero.`);
  }

  if (record.fechaTramite && Number.isNaN(new Date(record.fechaTramite).getTime())) {
    errors.push('La fecha del trámite no es válida.');
  }
  if (
    record.pesoNeto != null && record.pesoBruto != null &&
    record.pesoNeto > record.pesoBruto
  ) {
    errors.push('El peso neto no puede ser mayor que el peso bruto.');
  }

  const identity = recordIdentity(record);
  if (identity && existing.some(item => item.id !== record.id && recordIdentity(item) === identity)) {
    errors.push('Ya existe un registro con el mismo trámite, COTE, producto y corte.');
  }
  return errors;
}
