import { describe, expect, it } from 'bun:test';
import type { Shipment } from './types';
import { mergeImportedRecords } from './dataRepository';

const record = (id: string, tipo: Shipment['tipo']): Shipment => ({
  id,
  tipo,
  nroTramite: 1,
  fechaTramite: '2026-01-01T00:00:00.000Z',
  nroCote: id,
  nombreEstablecimientoDestino: '',
  paisDestino: '',
  denominacionMercaderia: '',
  corte: '',
  cantidadEnvases: null,
  pesoBruto: null,
  pesoNeto: null,
  pallets: null,
  tipoTransporte: null,
  matriculaCamion: null,
  precinto1: null,
  contenedorSerieNro: null,
  nroCertificadoSanitario: null,
  observaciones: null,
});

describe('mergeImportedRecords', () => {
  it('combina almacenes heredados y lotes actuales sin duplicar IDs', () => {
    const legacy = record('legacy', 'INGRESO');
    const duplicated = record('duplicated', 'INGRESO');
    const current = record('current', 'INGRESO');
    const result = mergeImportedRecords(
      [legacy, duplicated],
      [{ data: [duplicated, current] }],
      item => item.tipo === 'INGRESO',
    );
    expect(result.map(item => item.id)).toEqual(['legacy', 'duplicated', 'current']);
  });

  it('filtra por tipo dentro de lotes mixtos y tolera lotes históricos sin data', () => {
    const ingreso = record('in', 'INGRESO');
    const exportacion = record('out', 'EXPORTACION');
    const result = mergeImportedRecords(
      [],
      [{ data: undefined }, { data: [ingreso, exportacion] }],
      item => item.tipo === 'EXPORTACION',
    );
    expect(result).toEqual([exportacion]);
  });
});
