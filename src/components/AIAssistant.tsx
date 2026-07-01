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
    let context = `Sos un asistente experto en trazabilidad de frigoríficos. Respondé en español, claro y conciso.

PESTAÑA ACTUAL: ${activeTab}

`;
    // Load data from localStorage based on tab
    try {
      if (activeTab === 'trazabilidad-explorer' || activeTab === 'dashboard' || activeTab === 'cruces-x-cote') {
        // Stock + trazabilidad data
        const stockRaw = localStorage.getItem('trazabilidad_stock_data');
        if (stockRaw) {
          const stock = JSON.parse(stockRaw);
          const pallets = stock.pallets || [];
          const cotesSet = new Set<string>();
          pallets.forEach((p: any) => { if (p.codigo) cotesSet.add(p.codigo); });
          // Count by COTE
          const coteStats: Record<string, { cajas: number; kg: number; pallets: number; productos: Set<string> }> = {};
          pallets.forEach((p: any) => {
            if (!p.codigo) return;
            if (!coteStats[p.codigo]) coteStats[p.codigo] = { cajas: 0, kg: 0, pallets: 0, productos: new Set() };
            coteStats[p.codigo].cajas += p.cajas || 0;
            coteStats[p.codigo].kg += p.kilos || 0;
            coteStats[p.codigo].pallets += 1;
            if (p.producto) coteStats[p.codigo].productos.add(p.producto);
          });
          // Get manual ingresos
          const newRecs = JSON.parse(localStorage.getItem('trazabilidad_dep_new_records') || '[]');
          const manualByCote: Record<string, number> = {};
          newRecs.forEach((r: any) => {
            if (r.nroCote) manualByCote[r.nroCote] = (manualByCote[r.nroCote] || 0) + (r.cantidadEnvases || 0);
          });
          const cotes = Object.entries(coteStats).map(([cote, s]) => ({
            cote, cajas: s.cajas, kg: Math.round(s.kg), pallets: s.pallets,
            productos: [...s.productos].slice(0, 2),
            ingresoManual: manualByCote[cote] || 0,
          })).sort((a, b) => b.cajas - a.cajas);

          context += `DATOS DE STOCK (${stock.fecha || 'N/A'}):
- Total pallets: ${pallets.length}
- Total COTEs: ${cotes.length}
- Total cajas: ${cotes.reduce((s:number,c:any)=>s+c.cajas,0).toLocaleString('es-UY')}

COTEs EN STOCK (top 20):
${cotes.slice(0, 20).map((c:any) => `- ${c.cote}: ${c.cajas} cajas, ${c.pallets} pallets, ingreso manual=${c.ingresoManual}, productos: ${c.productos.join(', ')}`).join('\n')}
`;
        }
        // Also get dep_imported for ingresos
        const depRaw = localStorage.getItem('trazabilidad_dep_imported');
        if (depRaw) {
          const deps = JSON.parse(depRaw);
          if (Array.isArray(deps)) {
            context += `\nINGRESOS EN DEPÓSITOS: ${deps.length} registros\n`;
          }
        }
        // Exportaciones
        const expRaw = localStorage.getItem('trazabilidad_exp_imported');
        if (expRaw) {
          const exps = JSON.parse(expRaw);
          if (Array.isArray(exps)) {
            context += `EXPORTACIONES: ${exps.length} registros\n`;
          }
        }
      } else if (activeTab === 'depositos') {
        const depRaw = localStorage.getItem('trazabilidad_dep_imported');
        if (depRaw) {
          const deps = JSON.parse(depRaw);
          if (Array.isArray(deps)) {
            const cotes = new Set(deps.map((d:any) => d.nroCote).filter(Boolean));
            const totalCajas = deps.reduce((s:number,d:any) => s + (d.cantidadEnvases||0), 0);
            context += `DATOS A DEPÓSITOS:
- Registros: ${deps.length}
- COTEs únicos: ${cotes.size}
- Total cajas: ${totalCajas.toLocaleString('es-UY')}
`;
          }
        }
      } else if (activeTab === 'exportaciones') {
        const expRaw = localStorage.getItem('trazabilidad_exp_imported');
        if (expRaw) {
          const exps = JSON.parse(expRaw);
          if (Array.isArray(exps)) {
            const cotes = new Set(exps.map((e:any) => e.nroCote).filter(Boolean));
            const paises = new Set(exps.map((e:any) => e.paisDestino).filter(Boolean));
            context += `DATOS EXPORTACIONES:
- Registros: ${exps.length}
- COTEs únicos: ${cotes.size}
- Países destino: ${[...paises].join(', ')}
`;
          }
        }
      }
    } catch (e) {
      context += '\n(No pude cargar datos detallados)\n';
    }

    context += `\nEXPLICACIÓN DE CAUSAS DE DIFERENCIAS:
- A: Retorno de puerto sin ingreso registrado (mercadería que volvió de China)
- B: Pase sanitario (no en archivo de COTEs, canal paralelo para cordero)
- C: Doble conteo en exportación consolidada
- D: Exportación sin referencia en observaciones
- E: Ajuste menor (redondeo, reposicionamiento)

Podés ayudar a: analizar diferencias, explicar retornos/pases, buscar COTEs específicos, sugerir qué datos faltan.`;

    return context;
  }, [activeTab]);

  // Local fallback analysis
  const localAnalysis = (question: string): string => {
    const q = question.toLowerCase();
    const coteMatch = q.match(/(p\d{4,8}|b\d{4,8})/);
    if (coteMatch) {
      const coteUpper = coteMatch[1].toUpperCase();
      try {
        const stockRaw = localStorage.getItem('trazabilidad_stock_data');
        if (stockRaw) {
          const stock = JSON.parse(stockRaw);
          const pallets = (stock.pallets || []).filter((p:any) => p.codigo === coteUpper);
          if (pallets.length > 0) {
            const totalCajas = pallets.reduce((s:number,p:any) => s + (p.cajas||0), 0);
            const totalKg = pallets.reduce((s:number,p:any) => s + (p.kilos||0), 0);
            const productos = [...new Set(pallets.map((p:any) => p.producto).filter(Boolean))];
            const contenedores = [...new Set(pallets.map((p:any) => p.contenedor).filter(Boolean))];
            return `${coteUpper} — ${totalCajas.toLocaleString('es-UY')} cajas en ${pallets.length} pallets (${Math.round(totalKg).toLocaleString('es-UY')} kg)\n\nProductos: ${productos.slice(0,3).join(', ')}\nContenedores: ${contenedores.join(', ')}`;
          }
        }
      } catch {}
      return `No encontré ${coteUpper} en el stock actual.`;
    }
    if (q.includes('diferencia') || q.includes('diff') || q.includes('descuadre')) {
      return 'Para ver diferencias, andá a la pestaña Trazabilidad o Cruces X COTE. Usá el filtro "Con Diff" para ver los COTEs con descuadres.';
    }
    if (q.includes('retorno')) {
      return 'Los retornos son pallets que volvieron de China. En la pestaña Trazabilidad, filtra por "Retornos" para verlos.';
    }
    if (q.includes('hola') || q.includes('buenas') || q.includes('hey')) {
      return 'Hola! Soy tu asistente de trazabilidad. Preguntame sobre COTEs específicos, diferencias, retornos, o lo que necesites. Estoy viendo los datos de la pestaña actual.';
    }
    return `Pregunta: "${question}"\n\nEstoy analizando los datos de la pestaña "${activeTab}". Podés preguntarme sobre COTEs específicos (ej: P14739), diferencias, retornos, o pedir un resumen.`;
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
                  {['¿Cuáles son los COTEs con mayor diferencia?', '¿Qué son los retornos?', '¿Qué COTEs no tienen ingreso?', 'Dame un resumen', 'P14739'].map(q => (
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
