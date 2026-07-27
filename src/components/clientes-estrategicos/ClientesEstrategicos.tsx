'use client';

// ============================================================
// ClientesEstrategicos — Wrapper con selector de categoría
// ============================================================

import { useState } from 'react';
import { Building2, ChevronRight, Warehouse, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { FRIGORIFICOS_DEPOSITOS } from '@/intelligence-engine/frigorificosData';
import { FrigorieficosDepositos } from './FrigorieficosDepositos';

type SelectedCategory = 'A' | 'B' | null;

export function ClientesEstrategicos() {
  const [selected, setSelected] = useState<SelectedCategory>(null);

  if (selected === 'A' || selected === 'B') {
    return <FrigorieficosDepositos category={selected} onBack={() => setSelected(null)} />;
  }

  const catA = FRIGORIFICOS_DEPOSITOS.filter(f => f.categoria === 'A');
  const catB = FRIGORIFICOS_DEPOSITOS;
  const catBFrigorificosCaliral = FRIGORIFICOS_DEPOSITOS.filter(f => f.usaCaliral);

  const categorias = [
    {
      id: 'A' as const,
      titulo: 'Categoría A — Sin CALIRAL',
      desc: 'Frigoríficos que trabajan con depósitos externos pero NO utilizan CALIRAL. Análisis de competencia pura.',
      cantidad: catA.length,
      ejemplos: catA.slice(0, 4).map(f => f.name).join(' · '),
      icon: Warehouse,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-950/40',
    },
    {
      id: 'B' as const,
      titulo: 'Categoría B — Incluye CALIRAL',
      desc: 'Frigoríficos que trabajan con depósitos externos, incluyendo los que usan CALIRAL y sus competidores.',
      cantidad: catB.length,
      ejemplos: `Con CALIRAL: ${catBFrigorificosCaliral.map(f => f.name).join(' · ')}`,
      icon: Building2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="px-8 pt-8 pb-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-violet-600 dark:text-violet-400 font-semibold mb-1">
            Inteligencia Comercial
          </p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-1">
            Frigoríficos — Análisis por Depósitos Externos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Seleccioná una categoría para ver el detalle completo de cada frigorífico: kg, cortes, destinos, depósitos, mensual, tipo de producto.
          </p>
        </div>
      </div>

      <div className="px-8 pb-12">
        <div className="max-w-4xl mx-auto space-y-3">
          {categorias.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelected(cat.id)}
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-6 h-6 ${cat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{cat.titulo}</p>
                    <span className="text-xs text-slate-500">{cat.cantidad} frigoríficos</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cat.desc}</p>
                  <p className="text-[10px] text-slate-400 mt-1.5 italic">{cat.ejemplos}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
            );
          })}

          <Card className="p-5 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 mt-6">
            <div className="flex items-start gap-3">
              <Layers className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p><b>Cómo se usa:</b> Al entrar a una categoría, vas a ver la lista de frigoríficos con sus KPIs (kg, envases, registros, depósitos). Hacé clic en cualquiera para ver el detalle completo.</p>
                <p><b>Detalle por frigorífico:</b> cortes, países destino, depósitos usados con share %, tipo de producto (Congelado/Fresco), tipo de movimiento (Ingreso/Exportación) y evolución mensual.</p>
                <p><b>Ranking de depósitos competidores:</b> al final de cada categoría, un chart muestra qué depósitos mueven más kg entre los frigoríficos analizados.</p>
                <p><b>Fuente:</b> Dataset embarques.xlsx (52,940 registros del MGAP).</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
