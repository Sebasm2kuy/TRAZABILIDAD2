'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import ShipmentTable from '@/components/shipments/ShipmentTable';
import ExportacionesTable from '@/components/exportaciones/ExportacionesTable';
import CruceCaliral from '@/components/cruce-caliral/CruceCaliral';
import TraceSearch from '@/components/traceability/TraceSearch';
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts';
import ProductoDestino from '@/components/comparativa/ProductoDestino';
import ImportExportPanel from '@/components/import-export/ImportExportPanel';
import NewRecordForm from '@/components/new-record/NewRecordForm';
import { initialPull } from '@/lib/googleSheets';

export default function Home() {
  const { activeTab } = useAppStore();
  const [ready, setReady] = useState(false);

  // Always pull from Firebase on every page load before rendering
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Pull with a 5s timeout so we don't block forever offline
        const result = await Promise.race([
          initialPull(),
          new Promise<{ count: number; error?: string }>(resolve =>
            setTimeout(() => resolve({ count: 0, error: 'timeout' }), 5000)
          ),
        ]);
        if (result.error === 'timeout') {
          console.warn('Firebase pull timed out, using local data');
        }
      } catch {
        // Firebase not available, continue with local data
      }
      if (mounted) setReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Cargando datos...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'depositos': return <ShipmentTable />;
      case 'exportaciones': return <ExportacionesTable />;
      case 'cruce-caliral': return <CruceCaliral />;
      case 'trazabilidad': return <TraceSearch />;
      case 'comparativa': return <ProductoDestino />;
      case 'analiticas': return <AnalyticsCharts />;
      case 'importar': return <ImportExportPanel />;
      case 'nuevo': return <NewRecordForm />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {renderContent()}
      </main>
    </div>
  );
}