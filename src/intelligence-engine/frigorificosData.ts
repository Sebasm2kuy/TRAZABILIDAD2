// ============================================================
// FRIGORIFICOS DEPOSITOS — Datos de frigoríficos estratégicos
// ------------------------------------------------------------
// Lista hardcodeada de frigoríficos que trabajan con depósitos
// externos, con su categorización:
//   - Categoría A: usan depósitos externos pero NO CALIRAL
//   - Categoría B: usan depósitos externos INCLUSIVE CALIRAL
// ============================================================

export interface FrigorificoInfo {
  name: string;
  aliases: string[];
  depositos: string[];
  usaCaliral: boolean;
  categoria: 'A' | 'B';
}

// ============================================================
// FIX: aliases actualizados para matchear los nombres REALES del
// Excel embarques.xlsx (con tildes y espacios). El matcher en
// isFrigorificoRecord() normaliza tildes y case.
// ============================================================

export const FRIGORIFICOS_DEPOSITOS: FrigorificoInfo[] = [
  // =========================================================
  // CATEGORÍA B — Usan CALIRAL (incluido NIREA / SAN JACINTO)
  // =========================================================
  {
    name: 'COLTIREY',
    aliases: ['COLTIREY'],
    depositos: ['COLTIREY', 'CALIRAL'],
    usaCaliral: true,
    categoria: 'B',
  },
  {
    name: 'PROBIOMONT',
    aliases: ['PROBIOMONT'],
    depositos: ['PROBIOMONT', 'CALIRAL', 'MONTESERA'],
    usaCaliral: true,
    categoria: 'B',
  },
  {
    // NIREA / SAN JACINTO es el frigorífico de la empresa dueña de Caliral.
    // Según el Excel: usa CALIRAL como certificador (1.35M kg) Y como
    // destino (1.58M kg), además de ARBIZA y DINOLAR.
    name: 'SAN JACINTO (NIREA)',
    aliases: ['SAN JACINTO', 'NIREA'],
    depositos: ['SAN JACINTO (NIREA)', 'CALIRAL', 'ARBIZA', 'DINOLAR'],
    usaCaliral: true,
    categoria: 'B',
  },

  // =========================================================
  // CATEGORÍA A — Usan depósitos externos pero NO CALIRAL
  // =========================================================
  {
    name: 'COLONIA',
    aliases: ['COLONIA'],
    depositos: ['COLONIA', 'TACUAREMBO', 'TELACAR'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'CARRASCO',
    aliases: ['CARRASCO'],
    depositos: ['ARBIZA'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    // En el Excel: 'Frigorífico Casa Blanca' (separado)
    name: 'CASA BLANCA',
    aliases: ['CASA BLANCA', 'CASABLANCA'],
    depositos: ['CASA BLANCA', 'DINOLAR'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'CLAY',
    aliases: ['CLAY'],
    depositos: ['CLAY', 'ARBIZA'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'LA CABALLADA',
    aliases: ['LA CABALLADA', 'CABALLADA'],
    depositos: ['LA CABALLADA', 'COLONIA', 'TACUAREMBO', 'INALER', 'TELACAR'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'LAS MORAS',
    aliases: ['LAS MORAS'],
    depositos: ['LAS MORAS', 'ARBIZA'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'PANDO',
    aliases: ['PANDO'],
    depositos: ['PANDO', 'DINOLAR'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'PUL',
    aliases: ['PUL'],
    depositos: ['PUL', 'ARBIZA', 'TELACAR'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    // En el Excel: 'Frigorífico Tacuarembó S.A.' (con tilde)
    name: 'TACUAREMBO',
    aliases: ['TACUAREMBO', 'TACUAREMBÓ'],
    depositos: ['TACUAREMBO', 'COLONIA', 'INALER', 'MVDMART', 'TELACAR'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'INALER',
    aliases: ['INALER'],
    depositos: ['INALER', 'TACUAREMBO', 'LA CABALLADA'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    name: 'LONSA SCIENCE',
    aliases: ['LONSA'],
    depositos: ['LONSA SCIENCE', 'ARBIZA'],
    usaCaliral: false,
    categoria: 'A',
  },
  {
    // En el Excel: 'Solís Meat Uruguay' (con tilde)
    name: 'SOLIS',
    aliases: ['SOLIS', 'SOLÍS'],
    depositos: ['SOLIS', 'DINOLAR'],
    usaCaliral: false,
    categoria: 'A',
  },
];

export function getFrigorificosByCategoria(cat: 'A' | 'B'): FrigorificoInfo[] {
  if (cat === 'B') return FRIGORIFICOS_DEPOSITOS;
  return FRIGORIFICOS_DEPOSITOS.filter(f => f.categoria === 'A');
}

// ============================================================
// FIX: normalizar tildes y case para que los aliases matcheen los
// nombres reales del Excel (con tildes y mayúsculas mezcladas).
// ============================================================
function normalize(s: string): string {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar tildes
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFrigorificoRecord(
  productorField: string,
  frigorifico: FrigorificoInfo,
): boolean {
  if (!productorField) return false;
  const normalized = normalize(productorField);
  return frigorifico.aliases.some(a => normalized.includes(normalize(a)));
}

export const DEPOSITOS_COMPETIDORES: string[] = (() => {
  const set = new Set<string>();
  for (const f of FRIGORIFICOS_DEPOSITOS) {
    for (const d of f.depositos) {
      if (normalize(d) !== 'CALIRAL') set.add(d);
    }
  }
  return [...set].sort();
})();
