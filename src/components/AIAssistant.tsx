'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Sparkles, X, Minus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import React from 'react';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const STORAGE_KEY = 'trazabilidad_chat_history';

// Declare puter for TypeScript
declare global {
  interface Window { puter?: any; }
}

export default function AIAssistant() {
  const { activeTab } = useAppStore();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ x: typeof window !== 'undefined' ? window.innerWidth - 420 : 0, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [puterReady, setPuterReady] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load persisted messages on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  // Persist messages whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Check if puter is available
  useEffect(() => {
    const checkPuter = () => {
      if (typeof window !== 'undefined' && window.puter) {
        setPuterReady(true);
        return true;
      }
      return false;
    };
    if (checkPuter()) return;
    const interval = setInterval(() => {
      if (checkPuter()) clearInterval(interval);
    }, 500);
    setTimeout(() => clearInterval(interval), 10000);
    return () => clearInterval(interval);
  }, []);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (minimized) return;
    setDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragOffset]);

  // Build context based on active tab + localStorage data
  const buildContext = useCallback(() => {
    let context = `Sos un INGENIERO DE TRAZABILIDAD integrado en la app. Conocés cómo funciona la app y podés detectar bugs e inconsistencias entre pestañas.

CÓMO FUNCIONA LA APP:
- Pestaña "A Depósitos" (depositos): ingresos a Caliral/Frimaral. Datos en localStorage:
  • trazabilidad_dep_imported: importaciones de Excel (3763 registros)
  • trazabilidad_dep_new_records: registros creados manualmente o via PDF
  • trazabilidad_dep_edits: ediciones a registros (pueden cambiar nroCote)
  • trazabilidad_dep_deleted: IDs eliminados
- Pestaña "Exportaciones" (exportaciones): exportaciones certificadas. Datos en:
  • trazabilidad_exp_imported, trazabilidad_new_records, trazabilidad_exp_edits, trazabilidad_exp_deleted
- Pestaña "Trazabilidad" (trazabilidad-explorer): vista unificada que cruza stock + ingresos + exportaciones. Lee de stock_trazabilidad.json + dep_new_records + dep_edits + dep_imported
- Pestaña "Cruces X COTE" (cruces-x-cote): similar, cruza por COTE
- Stock: datos del archivo XLS del depósito, guardado en trazabilidad_stock_data

INCONSISTENCIAS COMUNES QUE DEBES DETECTAR:
1. COTE en A Depósitos pero NO en Trazabilidad (ej: edicion cambio nroCote pero Trazabilidad no lo lee)
2. COTE en Stock pero NO en Ingresos (retornos, pases sanitarios)
3. Diferencias negativas grandes (exportación sin referencia en observaciones)
4. Doble conteo en exportaciones consolidadas
5. COTEs duplicados entre new_records y imported
6. Registros en edits que cambiaron nroCote pero el original sigue en imported

PESTAÑA ACTUAL: ${activeTab}

`;

    // Scan for inconsistencies
    try {
      const newRecs = JSON.parse(localStorage.getItem('trazabilidad_dep_new_records') || '[]');
      const edits = JSON.parse(localStorage.getItem('trazabilidad_dep_edits') || '{}');
      const imported = JSON.parse(localStorage.getItem('trazabilidad_dep_imported') || '[]');
      const deleted = JSON.parse(localStorage.getItem('trazabilidad_dep_deleted') || '[]');
      const stockRaw = localStorage.getItem('trazabilidad_stock_data');

      // Find COTEs in edits that are not in new_records
      const cotesInNew = new Set(newRecs.map((r:any) => r.nroCote).filter(Boolean));
      const cotesInEdits = new Set<string>();
      const editsNotInNew: string[] = [];
      for (const [editId, editData] of Object.entries(edits)) {
        const ed = editData as any;
        if (ed.nroCote && (editId.startsWith('new_dep_') || editId.startsWith('manual_'))) {
          cotesInEdits.add(ed.nroCote);
          if (!cotesInNew.has(ed.nroCote)) {
            editsNotInNew.push(`${ed.nroCote} (editId: ${editId}, cajas: ${ed.cantidadEnvases})`);
          }
        }
      }

      // Find COTEs in stock that have no ingreso anywhere
      const stockCotes = new Set<string>();
      if (stockRaw) {
        const stock = JSON.parse(stockRaw);
        (stock.pallets || []).forEach((p:any) => { if (p.codigo) stockCotes.add(p.codigo); });
      }
      const cotesInImported = new Set(imported.map((r:any) => r.nroCote).filter(Boolean));
      const stockSinIngreso: string[] = [];
      for (const cote of stockCotes) {
        if (!cotesInNew.has(cote) && !cotesInEdits.has(cote) && !cotesInImported.has(cote)) {
          stockSinIngreso.push(cote);
        }
      }

      context += `ESTADO DE DATOS:
- dep_imported: ${imported.length} registros, ${cotesInImported.size} COTEs únicos
- dep_new_records: ${newRecs.length} registros, ${cotesInNew.size} COTEs únicos
- dep_edits: ${Object.keys(edits).length} ediciones, ${cotesInEdits.size} COTEs únicos
- dep_deleted: ${deleted.length} eliminados
- stock_data: ${stockCotes.size} COTEs únicos

INCONSISTENCIAS DETECTADAS:
`;

      if (editsNotInNew.length > 0) {
        context += `⚠️ COTEs en EDITS pero NO en NEW_RECORDS (Trazabilidad podría no verlos):
${editsNotInNew.map(c => `  - ${c}`).join('\n')}
`;
      }

      if (stockSinIngreso.length > 0) {
        context += `⚠️ COTEs en STOCK sin ingreso en ningún lado (${stockSinIngreso.length}):
${stockSinIngreso.slice(0, 15).map(c => `  - ${c}`).join('\n')}
`;
      }

      // Stock data summary
      if (stockRaw) {
        const stock = JSON.parse(stockRaw);
        const pallets = stock.pallets || [];
        const coteStats: Record<string, { cajas: number; kg: number; pallets: number; productos: Set<string> }> = {};
        pallets.forEach((p:any) => {
          if (!p.codigo) return;
          if (!coteStats[p.codigo]) coteStats[p.codigo] = { cajas: 0, kg: 0, pallets: 0, productos: new Set() };
          coteStats[p.codigo].cajas += p.cajas || 0;
          coteStats[p.codigo].kg += p.kilos || 0;
          coteStats[p.codigo].pallets += 1;
          if (p.producto) coteStats[p.codigo].productos.add(p.producto);
        });
        const cotes = Object.entries(coteStats).map(([cote, s]) => ({
          cote, cajas: s.cajas, kg: Math.round(s.kg), pallets: s.pallets,
          productos: [...s.productos].slice(0, 2),
          hasIngreso: cotesInNew.has(cote) || cotesInEdits.has(cote) || cotesInImported.has(cote),
        })).sort((a, b) => b.cajas - a.cajas);

        context += `
COTEs EN STOCK (top 25):
${cotes.slice(0, 25).map((c:any) => `- ${c.cote}: ${c.cajas} cajas, ${c.pallets} pallets, ingreso=${c.hasIngreso ? 'SÍ' : 'NO'}, productos: ${c.productos.join(', ')}`).join('\n')}
`;
      }
    } catch (e) {
      context += '\n(Error cargando datos detallados)\n';
    }

    context += `\nComo ingeniero, debés:
1. Detectar bugs e inconsistencias entre pestañas
2. Explicar por qué un COTE aparece en un lado y no en otro
3. Sugerir fixes concretos
4. Analizar datos reales, no dar consejos genéricos`;

    return context;
  }, [activeTab]);

  // Local fallback analysis - acts as engineer detecting bugs
  const localAnalysis = (question: string): string => {
    const q = question.toLowerCase();

    // Scan for inconsistencies
    const newRecs = JSON.parse(localStorage.getItem('trazabilidad_dep_new_records') || '[]');
    const edits = JSON.parse(localStorage.getItem('trazabilidad_dep_edits') || '{}');
    const imported = JSON.parse(localStorage.getItem('trazabilidad_dep_imported') || '[]');
    const stockRaw = localStorage.getItem('trazabilidad_stock_data');

    const cotesInNew = new Set(newRecs.map((r:any) => r.nroCote).filter(Boolean));
    const cotesInImported = new Set(imported.map((r:any) => r.nroCote).filter(Boolean));
    const cotesInEdits = new Set<string>();
    const editsByCote: Record<string, any[]> = {};
    for (const [editId, editData] of Object.entries(edits)) {
      const ed = editData as any;
      if (ed.nroCote) {
        cotesInEdits.add(ed.nroCote);
        if (!editsByCote[ed.nroCote]) editsByCote[ed.nroCote] = [];
        editsByCote[ed.nroCote].push({ id: editId, data: ed });
      }
    }

    const stockCotes = new Set<string>();
    if (stockRaw) {
      try {
        const stock = JSON.parse(stockRaw);
        (stock.pallets || []).forEach((p:any) => { if (p.codigo) stockCotes.add(p.codigo); });
      } catch {}
    }

    // Specific COTE query
    const coteMatch = q.match(/(p\d{4,8}|b\d{4,8})/);
    if (coteMatch) {
      const coteUpper = coteMatch[1].toUpperCase();
      let resp = `ANÁLISIS DE ${coteUpper}:\n\n`;
      const inNew = cotesInNew.has(coteUpper);
      const inImported = cotesInImported.has(coteUpper);
      const inEdits = cotesInEdits.has(coteUpper);
      const inStock = stockCotes.has(coteUpper);

      resp += `UBICACIÓN:\n`;
      resp += `• A Depósitos (imported): ${inImported ? 'SÍ' : 'NO'}\n`;
      resp += `• A Depósitos (new_records): ${inNew ? 'SÍ' : 'NO'}\n`;
      resp += `• A Depósitos (edits): ${inEdits ? 'SÍ' : 'NO'}\n`;
      resp += `• Stock: ${inStock ? 'SÍ' : 'NO'}\n\n`;

      // Get cajas from each source
      const newCajas = newRecs.filter((r:any) => r.nroCote === coteUpper).reduce((s:number, r:any) => s + (r.cantidadEnvases||0), 0);
      const importedCajas = imported.filter((r:any) => r.nroCote === coteUpper).reduce((s:number, r:any) => s + (r.cantidadEnvases||0), 0);
      const editCajas = (editsByCote[coteUpper] || []).reduce((s:number, e:any) => s + (e.data.cantidadEnvases||0), 0);

      resp += `CAJAS:\n`;
      if (inImported) resp += `• imported: ${importedCajas.toLocaleString('es-UY')} cajas\n`;
      if (inNew) resp += `• new_records: ${newCajas.toLocaleString('es-UY')} cajas\n`;
      if (inEdits) resp += `• edits: ${editCajas.toLocaleString('es-UY')} cajas\n`;

      // Detect bug
      if ((inNew || inEdits || inImported) && !inStock) {
        resp += `\n⚠️ BUG: ${coteUpper} tiene ingreso pero NO está en stock. Posiblemente ya se exportó completamente.\n`;
      }
      if (inStock && !inNew && !inEdits && !inImported) {
        resp += `\n⚠️ BUG: ${coteUpper} está en stock pero NO tiene ingreso en ningún lado. Puede ser retorno o pase sanitario.\n`;
      }
      if (inEdits && !inNew) {
        resp += `\n⚠️ BUG DETECTADO: ${coteUpper} está en EDITS pero NO en NEW_RECORDS.\n`;
        resp += `Esto significa que el registro fue creado en A Depósitos (como new_dep_) y luego editado, pero la edición se guardó en dep_edits y no en dep_new_records.\n`;
        resp += `Trazabilidad Explorer DEBERÍA leer dep_edits para verlo. Si no lo hace, es un bug.\n`;
        resp += `Fix: Trazabilidad Explorer debe combinar dep_new_records + dep_edits (para IDs new_dep_) + dep_imported.\n`;
      }
      return resp;
    }

    // Detect bugs / inconsistencies
    if (q.includes('error') || q.includes('bug') || q.includes('inconsisten') || q.includes('verifica')) {
      let resp = `ANÁLISIS DE INCONSISTENCIAS:\n\n`;
      // Find COTEs in edits but not in new_records
      const editsNotInNew: string[] = [];
      for (const [editId, editData] of Object.entries(edits)) {
        const ed = editData as any;
        if (ed.nroCote && (editId.startsWith('new_dep_') || editId.startsWith('manual_'))) {
          if (!cotesInNew.has(ed.nroCote)) {
            editsNotInNew.push(`${ed.nroCote} (ID: ${editId}, ${ed.cantidadEnvases} cajas)`);
          }
        }
      }
      if (editsNotInNew.length > 0) {
        resp += `⚠️ COTEs en EDITS pero NO en NEW_RECORDS (${editsNotInNew.length}):\n`;
        resp += editsNotInNew.map(c => `  • ${c}`).join('\n');
        resp += `\n\nCAUSA: Estos COTEs fueron creados en A Depósitos y editados, pero la edición se guardó en dep_edits. Si Trazabilidad solo lee dep_new_records, no los verá.\n`;
        resp += `FIX: Trazabilidad debe leer dep_edits para IDs que empiezan con new_dep_/manual_.\n\n`;
      }
      // Find stock COTEs without ingreso
      const stockSinIngreso: string[] = [];
      for (const cote of stockCotes) {
        if (!cotesInNew.has(cote) && !cotesInEdits.has(cote) && !cotesInImported.has(cote)) {
          stockSinIngreso.push(cote);
        }
      }
      if (stockSinIngreso.length > 0) {
        resp += `⚠️ COTEs en STOCK sin ingreso (${stockSinIngreso.length}): ${stockSinIngreso.slice(0, 10).join(', ')}${stockSinIngreso.length > 10 ? '...' : ''}\n`;
        resp += `CAUSA: Retornos de China o pases sanitarios no en archivo de ingresos.\n\n`;
      }
      return resp || 'No detecté inconsistencias.';
    }

    if (q.includes('p14702')) {
      let resp = `P14702 - ANÁLISIS DE BUG:\n\n`;
      resp += `El usuario reporta que P14702 está en A Depósitos pero no en Trazabilidad.\n\n`;
      resp += `VERIFICACIÓN:\n`;
      resp += `• dep_imported: ${cotesInImported.has('P14702') ? 'SÍ' : 'NO'}\n`;
      resp += `• dep_new_records: ${cotesInNew.has('P14702') ? 'SÍ' : 'NO'}\n`;
      resp += `• dep_edits: ${cotesInEdits.has('P14702') ? 'SÍ' : 'NO'}\n`;
      resp += `• stock: ${stockCotes.has('P14702') ? 'SÍ' : 'NO'}\n\n`;
      if (cotesInEdits.has('P14702') && !cotesInNew.has('P14702')) {
        resp += `BUG CONFIRMADO: P14702 está en dep_edits pero NO en dep_new_records.\n`;
        resp += `Esto significa que el registro fue creado en A Depósitos (ID new_dep_...) y editado.\n`;
        resp += `La edición se guardó en dep_edits con nroCote='P14702'.\n`;
        resp += `Trazabilidad Explorer solo lee dep_new_records, por eso no lo ve.\n\n`;
        resp += `FIX: Trazabilidad Explorer debe leer dep_edits para IDs new_dep_ y combinar con dep_new_records.\n`;
        resp += `Ya aplicamos el fix en el código - ahora lee dep_new_records + dep_edits + dep_imported.`;
      }
      return resp;
    }

    if (q.includes('hola') || q.includes('buenas') || q.includes('hey')) {
      return `Hola! Soy tu ingeniero de trazabilidad. Monitoreo los datos en tiempo real y detecto bugs.\n\nSoy consciente de cómo funciona la app:\n- A Depósitos guarda en dep_imported, dep_new_records, dep_edits\n- Trazabilidad cruza stock + ingresos + exportaciones\n- Si un COTE está en un lado y no en otro, lo detecto\n\nPreguntame sobre un COTE específico (ej: P14702) o pedime "verifica errores".`;
    }

    return `Pregunta: "${question}"\n\nSoy un ingeniero que analiza datos reales. Probá:\n• "P14702" - analiza un COTE específico\n• "verifica errores" - escanea inconsistencias\n• "bugs" - detecta problemas entre pestañas`;
  };

  const askAI = async (question: string) => {
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: question }]);

    if (puterReady && window.puter?.ai?.chat) {
      try {
        const context = buildContext();
        // Add timeout: if GPT doesn't respond in 25s, use local analysis
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('GPT timeout')), 25000)
        );
        const chatPromise = window.puter.ai.chat([
          { role: 'system', content: context },
          ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: question }
        ], { model: 'gpt-4o-mini' });
        const response = await Promise.race([chatPromise, timeoutPromise]);
        let answer = response?.message?.content || response?.message || '';
        if (typeof answer !== 'string') answer = JSON.stringify(answer);
        if (!answer) answer = 'No pude procesar la consulta.';
        setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        setLoading(false);
        return;
      } catch (err) {
        console.warn('Puter AI failed, using local:', err);
      }
    }
    // Fallback to local analysis
    await new Promise(r => setTimeout(r, 400));
    const answer = localAnalysis(question);
    setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    setLoading(false);
  };

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    const q = input;
    setInput('');
    askAI(q);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Floating button (when closed)
  if (!open) {
    return (
      <button
        className="fixed bottom-6 right-6 z-50 bg-violet-600 hover:bg-violet-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 group"
        onClick={() => setOpen(true)}
        title="Abrir asistente IA"
      >
        <Bot className="h-6 w-6" />
        <span className="hidden group-hover:inline text-sm font-medium pr-2">Asistente IA</span>
        {messages.length > 0 && <span className="absolute -top-1 -right-1 bg-emerald-400 rounded-full h-3 w-3 border-2 border-violet-600"></span>}
      </button>
    );
  }

  return (
    <div
      ref={dragRef}
      className="fixed z-50 bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: 400,
        height: minimized ? 'auto' : 520,
        maxHeight: minimized ? 'auto' : '80vh',
      }}
    >
      {/* Header (draggable) */}
      <div
        className="flex items-center justify-between bg-violet-600 text-white px-3 py-2 rounded-t-lg cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-semibold">Asistente IA</span>
          {puterReady ? (
            <span className="text-[9px] bg-emerald-400 text-emerald-900 px-1.5 py-0.5 rounded-full">GPT-4o</span>
          ) : (
            <span className="text-[9px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full">Local</span>
          )}
          <span className="text-[9px] text-violet-200">{activeTab}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button className="p-1 hover:bg-violet-700 rounded transition-colors" onClick={clearChat} title="Borrar conversación">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button className="p-1 hover:bg-violet-700 rounded transition-colors" onClick={() => setMinimized(!minimized)} title={minimized ? "Maximizar" : "Minimizar"}>
            {minimized ? <span className="text-xs">□</span> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button className="p-1 hover:bg-red-500 rounded transition-colors" onClick={() => { setOpen(false); setMinimized(false); }} title="Cerrar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body (hidden when minimized) */}
      {!minimized && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 min-h-[300px] max-h-[400px]">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Hola! Soy tu asistente de trazabilidad</p>
                <p className="text-xs mt-1">{puterReady ? 'Conectado a GPT-4o-mini' : 'Análisis local activo'}</p>
                <p className="text-[10px] mt-1 text-violet-500">Viendo: {activeTab}</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {['Verifica errores', 'P14702', '¿Qué COTEs no están en Trazabilidad?', 'Dame un resumen', 'bugs'].map(q => (
                    <button key={q} className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors" onClick={() => askAI(q)}>{q}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-white border text-slate-700'}`}>{msg.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-lg p-3 text-sm text-slate-400 flex items-center gap-2">
                  <Bot className="h-4 w-4 animate-pulse" />
                  {puterReady ? 'Consultando GPT-4o...' : 'Analizando datos...'}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t bg-white rounded-b-lg">
            <div className="flex gap-2">
              <Input placeholder="Hacé tu pregunta..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} disabled={loading} className="text-sm" />
              <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleSubmit} disabled={loading || !input.trim()} size="sm"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
