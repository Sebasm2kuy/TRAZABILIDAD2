'use client';
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Trash2, Table2 } from 'lucide-react';
import type { Shipment } from '@/lib/types';
import { dataUrl } from '@/lib/staticData';
import { STORAGE_KEYS, readStorageJson, writeStorageJson } from '@/lib/dataRepository';
import { schedulePush } from '@/lib/googleSheets';
import { type ImportedBatch, prependBatch, processImportRows, removeBatchCopies } from '@/lib/importExportBatches';

const BATCHES_KEY = STORAGE_KEYS.importedBatches;

function loadBatches(): ImportedBatch[] {
  return readStorageJson<ImportedBatch[]>(BATCHES_KEY, []);
}
function saveBatches(batches: ImportedBatch[]) {
  writeStorageJson(BATCHES_KEY, batches);
}

function notifyDataChanged() {
  window.dispatchEvent(new Event('trazabilidad-data-ready'));
}

function removeLegacyCopies(removedBatches: ImportedBatch[]) {
  const deposits = readStorageJson<Shipment[]>(STORAGE_KEYS.depImported, []);
  const exports = readStorageJson<Shipment[]>(STORAGE_KEYS.expImported, []);
  writeStorageJson(STORAGE_KEYS.depImported, removeBatchCopies(deposits, removedBatches));
  writeStorageJson(STORAGE_KEYS.expImported, removeBatchCopies(exports, removedBatches));
}

export default function ImportExportPanel() {
  const [batches, setBatches] = useState<ImportedBatch[]>(() => loadBatches());
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: number; fail: number; ambiguous: number; batchId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewBatch, setPreviewBatch] = useState<ImportedBatch | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setLastResult(null);

    try {
      const XLSX = await import('xlsx');
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);

      if (rows.length === 0) {
        setLastResult({ ok: 0, fail: rows.length, ambiguous: 0, batchId: '' });
        setImporting(false);
        return;
      }

      const batchId = `batch-${crypto.randomUUID()}`;
      const { shipments: mapped, invalid: fail, ambiguous, tipo } = processImportRows(rows, batchId);

      const batch: ImportedBatch = {
        id: batchId,
        name: file.name,
        date: new Date().toISOString(),
        count: mapped.length,
        tipo,
        data: mapped,
      };

      // Read again after the asynchronous file parsing to avoid overwriting a
      // batch saved while this file was being processed.
      const updated = prependBatch(batch, loadBatches());
      setBatches(updated);
      saveBatches(updated);

      notifyDataChanged();
      schedulePush();
      setLastResult({ ok: mapped.length, fail, ambiguous, batchId: batch.id });
    } catch (err) {
      console.error(err);
      setLastResult({ ok: 0, fail: -1, ambiguous: 0, batchId: '' });
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const deleteBatch = (id: string) => {
    const latest = loadBatches();
    const removed = latest.filter(b => b.id === id);
    const updated = latest.filter(b => b.id !== id);
    removeLegacyCopies(removed);
    setBatches(updated);
    saveBatches(updated);
    if (previewBatch?.id === id) setPreviewBatch(null);
    notifyDataChanged();
    schedulePush();
  };

  const clearAll = () => {
    const latest = loadBatches();
    removeLegacyCopies(latest);
    setBatches([]);
    saveBatches([]);
    setPreviewBatch(null);
    setLastResult(null);
    notifyDataChanged();
    schedulePush();
  };

  const exportAllBatches = async () => {
    const XLSX = await import('xlsx');
    const allData = batches.flatMap(b => b.data.map(s => ({
      'Tipo': s.tipo, 'Nro. Trámite': s.nroTramite,
      'Fecha': s.fechaTramite?.split('T')[0] || '', 'COTE': s.nroCote,
      'País': s.paisDestino, 'Destino': s.nombreEstablecimientoDestino,
      'Producto': s.denominacionMercaderia, 'Corte': s.corte,
      'Envases': s.cantidadEnvases, 'Peso Bruto': s.pesoBruto, 'Peso Neto': s.pesoNeto,
      'Contenedor': s.contenedorSerieNro || '', 'Precinto': s.precinto1 || '',
      'Transporte': s.tipoTransporte || '', 'Observaciones': s.observaciones || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allData), 'Importados');
    XLSX.writeFile(wb, `datos_importados_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportOriginal = () => {
    fetch(dataUrl('data/shipments.json')).then(r => r.json()).then(async (shipments) => {
      const XLSX = await import('xlsx');
      const data = (shipments as Record<string, unknown>[]).map(s => ({
        'Nro. Trámite': s.nroTramite, 'Fecha': s.fechaTramite ? new Date(s.fechaTramite as string).toISOString().split('T')[0] : '',
        'COTE': s.nroCote, 'Destino': s.nombreEstablecimientoDestino, 'País': s.paisDestino,
        'Producto': s.denominacionMercaderia, 'Corte': s.corte, 'Envases': s.cantidadEnvases,
        'Peso Bruto': s.pesoBruto, 'Peso Neto': s.pesoNeto, 'Transporte': s.tipoTransporte,
        'Matrícula': s.matriculaCamion, 'Precinto': s.precinto1, 'Tipo': s.tipo,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Envíos');
      XLSX.writeFile(wb, `trazabilidad_original_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const exportExpOriginal = () => {
    fetch(dataUrl('data/exportaciones.json')).then(r => r.json()).then(async (exports) => {
      const XLSX = await import('xlsx');
      const data = (exports as Record<string, unknown>[]).map(s => ({
        'Nro. Trámite': s.nroTramite, 'Fecha': s.fechaTramite ? new Date(s.fechaTramite as string).toISOString().split('T')[0] : '',
        'COTE': s.nroCote, 'País': s.paisDestino, 'Destino': s.nombreEstablecimientoDestino,
        'Producto': s.denominacionMercaderia, 'Corte': s.corte, 'Envases': s.cantidadEnvases,
        'Peso Bruto': s.pesoBruto, 'Peso Neto': s.pesoNeto,
        'Contenedor': s.contenedorSerieNro, 'Precinto': s.precinto1,
        'Cert. Sanitario': s.nroCertificadoSanitario, 'Transporte': s.tipoTransporte,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Exportaciones');
      XLSX.writeFile(wb, `exportaciones_original_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  const totalImported = batches.reduce((s, b) => s + b.count, 0);

  return (
    <div className="p-6 space-y-4 max-w-[1100px]">
      <h2 className="text-2xl font-bold text-slate-800">Importar / Exportar</h2>

      {/* Import card */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-amber-600" />Importar Datos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Cargá un archivo Excel (.xlsx) o CSV con los datos de envíos. El sistema detecta automáticamente si son ingresos o exportaciones según las columnas.</p>

          <div className="flex flex-wrap gap-2 items-center">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Procesando...' : 'Seleccionar archivo'}
            </Button>
          </div>

          {lastResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${lastResult.fail === -1 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {lastResult.fail === -1 ? (
                <><AlertTriangle className="h-4 w-4 shrink-0" /><span>Error al leer el archivo. Verificá que sea un Excel o CSV válido.</span></>
              ) : (
                <><CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{lastResult.ok} registros importados{lastResult.fail > 0 ? `, ${lastResult.fail} filas ignoradas (sin trámite ni COTE)` : ''}{lastResult.ambiguous > 0 ? `, ${lastResult.ambiguous} filas ambiguas ignoradas` : ''}</span></>
              )}
            </div>
          )}

          <div className="text-[11px] text-slate-400 space-y-1">
            <p><b>Columnas reconocidas:</b> Nro. Trámite, Fecha, COTE, País/Destino, Producto, Corte, Envases, Peso Bruto, Peso Neto, Contenedor, Precinto, Transporte, Observaciones</p>
            <p>Se respeta la columna Tipo. Sin ella, CALIRAL se considera Ingreso; País y Destino indican Exportación. Las filas con señales incompletas o tipos no reconocidos se informan como ambiguas y no se importan.</p>
          </div>
        </CardContent>
      </Card>

      {/* Export card */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4 text-emerald-600" />Exportar Datos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Descargá los datos en formato Excel.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportOriginal} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              <FileSpreadsheet className="h-4 w-4 mr-2" />Envíos (Ingresos)
            </Button>
            <Button variant="outline" onClick={exportExpOriginal} className="border-blue-300 text-blue-700 hover:bg-blue-50">
              <FileSpreadsheet className="h-4 w-4 mr-2" />Exportaciones
            </Button>
            {batches.length > 0 && (
              <Button variant="outline" onClick={exportAllBatches} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                <FileSpreadsheet className="h-4 w-4 mr-2" />Datos Importados ({totalImported})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Imported batches */}
      {batches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Table2 className="h-4 w-4 text-violet-600" />Datos Importados ({totalImported} registros en {batches.length} lotes)</CardTitle>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Borrar todo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b text-left text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2 text-right">Registros</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs font-medium">{b.name}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${b.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-700' : b.tipo === 'mixto' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                          {b.tipo === 'ingreso' ? 'Ingreso' : b.tipo === 'mixto' ? 'Mixto' : 'Exportación'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{new Date(b.date).toLocaleString('es-UY')}</td>
                      <td className="px-3 py-2 text-xs text-right font-mono font-bold">{b.count}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setPreviewBatch(previewBatch?.id === b.id ? null : b)}>
                            {previewBatch?.id === b.id ? 'Ocultar' : 'Ver'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-[11px] text-red-400 hover:text-red-600" onClick={() => deleteBatch(b.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewBatch && (
              <div className="border-t overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10">
                    <tr className="border-b text-left text-[10px] text-slate-500 uppercase">
                      <th className="px-2 py-1.5">Trámite</th><th className="px-2 py-1.5">Fecha</th><th className="px-2 py-1.5">COTE</th>
                      <th className="px-2 py-1.5">País</th><th className="px-2 py-1.5">Producto</th>
                      <th className="px-2 py-1.5 text-right">Envases</th><th className="px-2 py-1.5 text-right">Kg Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewBatch.data.slice(0, 100).map((s, i) => (
                      <tr key={s.id + i} className="border-b hover:bg-slate-50">
                        <td className="px-2 py-1 font-mono">{s.nroTramite}</td>
                        <td className="px-2 py-1">{s.fechaTramite?.split('T')[0] || ''}</td>
                        <td className="px-2 py-1 font-mono font-medium">{s.nroCote}</td>
                        <td className="px-2 py-1">{s.paisDestino}</td>
                        <td className="px-2 py-1 max-w-[150px] truncate">{s.denominacionMercaderia}</td>
                        <td className="px-2 py-1 text-right font-mono">{s.cantidadEnvases ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{s.pesoNeto ? s.pesoNeto.toLocaleString('es-UY') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewBatch.data.length > 100 && (
                  <p className="text-[11px] text-slate-400 text-center py-2">Mostrando 100 de {previewBatch.data.length} registros</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
