// ============================================================
// MovRecord — tipo compartido para registros del mercado
// ============================================================

export interface MovRecord {
  t: string; f: string; c: string; cf: string; p: string; np: string;
  ed: string; tm: string; pa: string; d: string; co: string;
  pa2: number; e: number; pb: number; pn: number; tt: string; sh: string;
  tpd?: string; tp?: number | null;
  isd?: boolean; // is deposito (productor != certificador)
  dep?: string;
}
