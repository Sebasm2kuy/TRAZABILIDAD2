import { describe, expect, it } from 'bun:test';
import type { Shipment } from './types';
import { prependBatch, processImportRows, removeBatchCopies, type ImportedBatch } from './importExportBatches';

const now = new Date('2026-01-02T12:00:00.000Z');
const ingreso = { 'Nro. Trámite': 1, COTE: 'in-1', Destino: 'CALIRAL', País: 'URUGUAY' };
const exportacion = { 'Nro. Trámite': 2, COTE: 'ex-1', Destino: 'Frigorífico Exterior', País: 'BRASIL' };

describe('processImportRows', () => {
  it('clasifica un archivo compuesto únicamente por ingresos', () => {
    const result = processImportRows([ingreso, { COTE: 'in-2' }], 'batch-a', now);
    expect(result.tipo).toBe('ingreso');
    expect(result.shipments.map(row => row.tipo)).toEqual(['INGRESO', 'INGRESO']);
  });

  it('clasifica un archivo compuesto únicamente por exportaciones', () => {
    const result = processImportRows([exportacion], 'batch-a', now);
    expect(result.tipo).toBe('exportacion');
    expect(result.shipments[0].tipo).toBe('EXPORTACION');
  });

  it('clasifica cada fila y marca el lote mixto', () => {
    const result = processImportRows([ingreso, exportacion], 'batch-a', now);
    expect(result.tipo).toBe('mixto');
    expect(result.shipments.map(row => row.tipo)).toEqual(['INGRESO', 'EXPORTACION']);
  });

  it('no deja que una primera fila incompleta determine las exportaciones siguientes', () => {
    const result = processImportRows([{ COTE: 'dudosa', País: 'BRASIL' }, exportacion], 'batch-a', now);
    expect(result.ambiguous).toBe(1);
    expect(result.shipments).toHaveLength(1);
    expect(result.tipo).toBe('exportacion');
  });

  it('ignora filas sin trámite y sin COTE', () => {
    const result = processImportRows([{ Destino: 'CALIRAL' }, { País: 'BRASIL' }, ingreso], 'batch-a', now);
    expect(result.invalid).toBe(2);
    expect(result.shipments).toHaveLength(1);
  });

  it('genera identificadores únicos entre filas y lotes', () => {
    const first = processImportRows([ingreso, ingreso], 'batch-a', now);
    const second = processImportRows([ingreso], 'batch-b', now);
    expect(new Set([...first.shipments, ...second.shipments].map(row => row.id)).size).toBe(3);
  });
});

describe('removeBatchCopies', () => {
  const shipment = (id: string): Shipment => ({ ...processImportRows([ingreso], id, now).shipments[0], id });
  const oldBatch = (id: string, data: Shipment[]): ImportedBatch => ({
    id,
    name: `${id}.xlsx`,
    date: now.toISOString(),
    count: data.length,
    // Simula lotes históricos, anteriores al valor `mixto`.
    tipo: 'ingreso',
    data,
  });

  it('elimina las copias de un lote individual y preserva registros ajenos', () => {
    const owned = shipment('owned');
    const unrelated = shipment('unrelated');
    expect(removeBatchCopies([owned, unrelated], [oldBatch('old', [owned])])).toEqual([unrelated]);
  });

  it('permite borrar las copias correspondientes a todos los lotes', () => {
    const first = shipment('first');
    const second = shipment('second');
    const external = shipment('external');
    const result = removeBatchCopies(
      [first, second, external],
      [oldBatch('one', [first]), oldBatch('two', [second])],
    );
    expect(result).toEqual([external]);
  });

  it('tolera lotes antiguos sin datos', () => {
    const external = shipment('external');
    const legacy = { ...oldBatch('legacy', []), data: undefined } as unknown as ImportedBatch;
    expect(removeBatchCopies([external], [legacy])).toEqual([external]);
  });
});

describe('persistencia consecutiva', () => {
  it('mantiene el lote anterior al anteponer una importación a la lectura más reciente', () => {
    const prior = { id: 'prior' };
    const next = { id: 'next' };
    const persisted = prependBatch(next as ImportedBatch, [prior as ImportedBatch]);
    expect(persisted.map(batch => batch.id)).toEqual(['next', 'prior']);
  });
});
