// ============================================================
// AGREGADOR POR FRIGORIFICO — Calcula stats ricas por frigorífico
// ============================================================

import type { MovRecord } from '@/intelligence-engine/types';
import { type FrigorificoInfo, isFrigorificoRecord } from './frigorificosData';

export interface FrigorificoKPIs {
  totalKg: number;
  totalEnvases: number;
  totalRegistros: number;
  totalPallets: number;
  pesoBrutoTotal: number;
  fechaMin: string;
  fechaMax: string;
  paisesUnicos: number;
  cortesUnicos: number;
  depositosUnicos: number;
}

export interface BreakdownItem {
  label: string;
  kg: number;
  envases: number;
  registros: number;
  pct: number;
}

export interface MonthlyItem {
  month: string;
  kg: number;
  envases: number;
  registros: number;
}

export interface FrigorificoAnalysis {
  frigorifico: FrigorificoInfo;
  kpis: FrigorificoKPIs;
  byCorte: BreakdownItem[];
  byPais: BreakdownItem[];
  byDeposito: BreakdownItem[];
  byTipoProducto: BreakdownItem[];
  byTipoMovimiento: BreakdownItem[];
  byMes: MonthlyItem[];
}

export function analyzeFrigorifico(
  records: MovRecord[],
  frigorifico: FrigorificoInfo,
  periodStart?: string,
  periodEnd?: string,
): FrigorificoAnalysis {
  let filtered = records.filter(r => isFrigorificoRecord(r.p || '', frigorifico));
  if (periodStart) filtered = filtered.filter(r => (r.f || '') >= periodStart);
  if (periodEnd) filtered = filtered.filter(r => (r.f || '') <= periodEnd);

  let totalKg = 0, totalEnvases = 0, totalPallets = 0, pesoBrutoTotal = 0;
  let fechaMin = '', fechaMax = '';
  const paisesSet = new Set<string>();
  const cortesSet = new Set<string>();
  const depositosSet = new Set<string>();

  const byCorteMap = new Map<string, { kg: number; envases: number; registros: number }>();
  const byPaisMap = new Map<string, { kg: number; envases: number; registros: number }>();
  const byDepositoMap = new Map<string, { kg: number; envases: number; registros: number }>();
  const byTipoProductoMap = new Map<string, { kg: number; envases: number; registros: number }>();
  const byTipoMovMap = new Map<string, { kg: number; envases: number; registros: number }>();
  const byMesMap = new Map<string, { kg: number; envases: number; registros: number }>();

  for (const r of filtered) {
    const kg = r.pn || 0;
    const env = r.e || 0;
    const pal = r.pa2 || 0;
    const pb = r.pb || 0;
    totalKg += kg; totalEnvases += env; totalPallets += pal; pesoBrutoTotal += pb;

    const f = r.f || '';
    if (f) {
      if (!fechaMin || f < fechaMin) fechaMin = f;
      if (!fechaMax || f > fechaMax) fechaMax = f;
    }

    const pais = r.pa || '(sin país)';
    const corte = r.co || '(sin corte)';
    const deposito = r.cf || '(sin depósito)';
    const tipoProd = r.tpd || '(sin clasificar)';
    const tipoMov = r.t || '(sin tipo)';
    if (pais) paisesSet.add(pais);
    if (corte) cortesSet.add(corte);
    if (deposito) depositosSet.add(deposito);
    const mes = f ? f.substring(0, 7) : '(sin fecha)';

    addToMap(byCorteMap, corte, kg, env);
    addToMap(byPaisMap, pais, kg, env);
    addToMap(byDepositoMap, deposito, kg, env);
    addToMap(byTipoProductoMap, tipoProd, kg, env);
    addToMap(byTipoMovMap, tipoMov, kg, env);
    addToMap(byMesMap, mes, kg, env);
  }

  const totalKgForPct = totalKg || 1;
  return {
    frigorifico,
    kpis: {
      totalKg, totalEnvases, totalRegistros: filtered.length,
      totalPallets, pesoBrutoTotal, fechaMin, fechaMax,
      paisesUnicos: paisesSet.size, cortesUnicos: cortesSet.size, depositosUnicos: depositosSet.size,
    },
    byCorte: toBreakdown(byCorteMap, totalKgForPct),
    byPais: toBreakdown(byPaisMap, totalKgForPct),
    byDeposito: toBreakdown(byDepositoMap, totalKgForPct),
    byTipoProducto: toBreakdown(byTipoProductoMap, totalKgForPct),
    byTipoMovimiento: toBreakdown(byTipoMovMap, totalKgForPct),
    byMes: toMonthly(byMesMap),
  };
}

function addToMap(map: Map<string, { kg: number; envases: number; registros: number }>, key: string, kg: number, envases: number) {
  const cur = map.get(key) || { kg: 0, envases: 0, registros: 0 };
  cur.kg += kg; cur.envases += envases; cur.registros += 1;
  map.set(key, cur);
}

function toBreakdown(map: Map<string, { kg: number; envases: number; registros: number }>, totalKg: number): BreakdownItem[] {
  return [...map.entries()]
    .map(([label, v]) => ({ label, kg: v.kg, envases: v.envases, registros: v.registros, pct: (v.kg / totalKg) * 100 }))
    .sort((a, b) => b.kg - a.kg);
}

function toMonthly(map: Map<string, { kg: number; envases: number; registros: number }>): MonthlyItem[] {
  return [...map.entries()]
    .map(([month, v]) => ({ month, kg: v.kg, envases: v.envases, registros: v.registros }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function analyzeAllFrigorificos(
  records: MovRecord[],
  frigorificos: FrigorificoInfo[],
  periodStart?: string,
  periodEnd?: string,
): Map<string, FrigorificoAnalysis> {
  const result = new Map<string, FrigorificoAnalysis>();
  for (const f of frigorificos) {
    result.set(f.name, analyzeFrigorifico(records, f, periodStart, periodEnd));
  }
  return result;
}

export function rankDepositosCompetidores(analyses: Map<string, FrigorificoAnalysis>): BreakdownItem[] {
  const map = new Map<string, { kg: number; envases: number; registros: number }>();
  let totalKg = 0;
  for (const analysis of analyses.values()) {
    for (const item of analysis.byDeposito) {
      const cur = map.get(item.label) || { kg: 0, envases: 0, registros: 0 };
      cur.kg += item.kg; cur.envases += item.envases; cur.registros += item.registros;
      map.set(item.label, cur);
      totalKg += item.kg;
    }
  }
  return toBreakdown(map, totalKg || 1);
}
