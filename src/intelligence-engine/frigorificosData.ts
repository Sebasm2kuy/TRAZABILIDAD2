// ============================================================
// FRIGORIFICOS DEPOSITOS — Datos de frigoríficos estratégicos
// ------------------------------------------------------------

export interface FrigorificoInfo {
  name: string;
  aliases: string[];
  depositos: string[];
  usaCaliral: boolean;
  categoria: 'A' | 'B';
}

export const FRIGORIFICOS_DEPOSITOS: FrigorificoInfo[] = [
  // Categoría B — Usan CALIRAL
  { name: 'COLTIREY', aliases: ['COLTIREY'], depositos: ['COLTIREY', 'CALIRAL'], usaCaliral: true, categoria: 'B' },
  { name: 'PROBIOMONT', aliases: ['PROBIOMONT'], depositos: ['PROBIOMONT', 'CALIRAL', 'MONTESERA'], usaCaliral: true, categoria: 'B' },
  // Categoría A — Sin CALIRAL
  { name: 'COLONIA', aliases: ['COLONIA'], depositos: ['COLONIA', 'TACUAREMBO', 'TELACAR'], usaCaliral: false, categoria: 'A' },
  { name: 'CARRASCO', aliases: ['CARRASCO'], depositos: ['ARBIZA'], usaCaliral: false, categoria: 'A' },
  { name: 'CASABLANCA', aliases: ['CASABLANCA'], depositos: ['CASABLANCA', 'DINOLAR'], usaCaliral: false, categoria: 'A' },
  { name: 'CLAY', aliases: ['CLAY'], depositos: ['CLAY', 'ARBIZA'], usaCaliral: false, categoria: 'A' },
  { name: 'LA CABALLADA', aliases: ['LA CABALLADA', 'CABALLADA'], depositos: ['LA CABALLADA', 'COLONIA', 'TACUAREMBO', 'INALER', 'TELACAR'], usaCaliral: false, categoria: 'A' },
  { name: 'LAS MORAS', aliases: ['LAS MORAS'], depositos: ['LAS MORAS', 'ARBIZA'], usaCaliral: false, categoria: 'A' },
  { name: 'PANDO', aliases: ['PANDO'], depositos: ['PANDO', 'DINOLAR'], usaCaliral: false, categoria: 'A' },
  { name: 'PUL', aliases: ['PUL'], depositos: ['PUL', 'ARBIZA', 'TELACAR'], usaCaliral: false, categoria: 'A' },
  { name: 'TACUAREMBO', aliases: ['TACUAREMBO'], depositos: ['TACUAREMBO', 'COLONIA', 'INALER', 'MVDMART', 'TELACAR'], usaCaliral: false, categoria: 'A' },
  { name: 'INALER', aliases: ['INALER'], depositos: ['INALER', 'TACUAREMBO', 'LA CABALLADA'], usaCaliral: false, categoria: 'A' },
  { name: 'LONSA SCIENCE', aliases: ['LONSA SCIENCE', 'LONSA', 'LONSA_SCIENCE'], depositos: ['LONSA SCIENCE', 'ARBIZA'], usaCaliral: false, categoria: 'A' },
  { name: 'SOLIS', aliases: ['SOLIS'], depositos: ['SOLIS', 'DINOLAR'], usaCaliral: false, categoria: 'A' },
];

export function getFrigorificosByCategoria(cat: 'A' | 'B'): FrigorificoInfo[] {
  if (cat === 'B') return FRIGORIFICOS_DEPOSITOS;
  return FRIGORIFICOS_DEPOSITOS.filter(f => f.categoria === 'A');
}

export function isFrigorificoRecord(
  productorField: string,
  frigorifico: FrigorificoInfo,
): boolean {
  if (!productorField) return false;
  const upper = productorField.toUpperCase();
  return frigorifico.aliases.some(a => upper.includes(a.toUpperCase()));
}
