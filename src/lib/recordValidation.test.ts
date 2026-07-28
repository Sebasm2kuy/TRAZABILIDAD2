import { describe, expect, it } from 'bun:test';
import type { Shipment } from './types';
import { recordIdentity, validateShipmentRecord } from './recordValidation';

const valid = (overrides: Partial<Shipment> = {}): Shipment => ({
  id: 'record-1',
  nroTramite: 123,
  nroCote: 'P1234',
  fechaTramite: '2026-01-01T12:00:00.000Z',
  nombreEstablecimientoDestino: 'CALIRAL',
  paisDestino: 'URUGUAY',
  denominacionMercaderia: 'Carne',
  corte: 'Cuadril',
  cantidadEnvases: 10,
  pallets: 1,
  pesoBruto: 110,
  pesoNeto: 100,
  ...overrides,
});

describe('validateShipmentRecord', () => {
  it('acepta un registro coherente', () => {
    expect(validateShipmentRecord(valid())).toEqual([]);
  });

  it('exige trámite o COTE', () => {
    expect(validateShipmentRecord(valid({ nroTramite: 0, nroCote: '' }))).toContain('Ingresá un número de trámite o un COTE.');
  });

  it('rechaza cantidades negativas, no enteras y pesos incoherentes', () => {
    const errors = validateShipmentRecord(valid({ cantidadEnvases: 1.5, pallets: -1, pesoBruto: 90, pesoNeto: 100 }));
    expect(errors).toHaveLength(3);
  });

  it('rechaza fechas inválidas', () => {
    expect(validateShipmentRecord(valid({ fechaTramite: 'fecha imposible' }))).toContain('La fecha del trámite no es válida.');
  });

  it('detecta duplicados normalizando texto y excluye el propio registro', () => {
    const current = valid();
    const duplicate = valid({ id: 'record-2', nroCote: ' p1234 ', denominacionMercaderia: 'carne' });
    expect(recordIdentity(current)).toBe(recordIdentity(duplicate));
    expect(validateShipmentRecord(current, [current])).toEqual([]);
    expect(validateShipmentRecord(current, [duplicate])).toContain('Ya existe un registro con el mismo trámite, COTE, producto y corte.');
  });
});
