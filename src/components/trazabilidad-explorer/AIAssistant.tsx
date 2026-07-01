'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Sparkles, X, Minus, Maximize2, Square } from 'lucide-react';
import React from 'react';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

interface AIAssistantProps {
  data: any;
  stats: any;
}

// Declare puter for TypeScript
declare global {
  interface Window { puter?: any; }
}

export default function AIAssistant({ data, stats }: AIAssistantProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [puterReady, setPuterReady] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

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
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
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

  // Build context for AI
  const buildContext = useCallback(() => {
    if (!data) return '';
    const cotesConDiff = data.cotes.filter((c: any) => c.diff !== null && c.diff !== 0).slice(0, 30);
    const sinIngreso = data.cotes.filter((c: any) => c.ingresoCajas === 0);
    const retornos = data.cotes.filter((c: any) => c.isRetorno);
    return `Sos un asistente experto en trazabilidad de frigoríficos. Analizás datos de stock, ingresos y exportaciones de carne. Respondé en español, claro y conciso, con insights accionables.

DATOS DE TRAZABILIDAD ACTUAL:
- Fecha stock: ${data.fecha}
- Total COTEs en stock: ${data.cotes.length}
- Stock total: ${stats.stock.toLocaleString('es-UY')} cajas / ${data.cotes.reduce((s:number,c:any)=>s+c.stockKg,0).toLocaleString('es-UY')} kg
- Ingreso total: ${stats.ingreso.toLocaleString('es-UY')} cajas
- Export total (referenciado): ${stats.export.toLocaleString('es-UY')} cajas
- COTEs con diff=0 (perfecto): ${stats.diffZero}
- COTEs con diff!=0: ${stats.conDiff}
- Retornos de China: ${retornos.length}
- COTEs sin ingreso: ${sinIngreso.length}

COTEs CON DIFERENCIA (top 30):
${cotesConDiff.map((c: any) => `- ${c.cote}: stock=${c.stockCajas}, ingreso=${c.ingresoCajas}, export_ref=${c.expRefCajas}, diff=${c.diff}, causa=${c.causaDiffDesc}`).join('\n')}

COTEs SIN INGRESO:
${sinIngreso.map((c: any) => `- ${c.cote}: ${c.stockCajas} cajas, ${c.stockProductos[0] || 'N/A'}, ${c.isRetorno ? 'RETORNO' : c.tipo}`).join('\n')}

RETORNOS DE CHINA:
${retornos.map((c: any) => `- ${c.cote}: ${c.stockCajas} cajas, ${c.stockProductos[0] || 'N/A'}`).join('\n')}

EXPLICACIÓN DE CAUSAS:
- A: Retorno de puerto sin ingreso registrado (mercadería que volvió de China)
- B: Pase sanitario (no en archivo de COTEs, canal paralelo para cordero)
- C: Doble conteo en exportación consolidada (exportación referencia múltiples COTEs)
- D: Exportación sin referencia en observaciones (trazabilidad incompleta)
- E: Ajuste menor (redondeo, reposicionamiento de pallets)

Podés ayudar a:
1. Analizar diferencias y sugerir causas
2. Explicar qué son los retornos y pases sanitarios
3. Identificar COTEs problemáticos
4. Sugerir qué datos faltan para completar la trazabilidad
5. Buscar COTEs específicos y dar su estado completo`;
  }, [data, stats]);

  // Local fallback analysis
  const localAnalysis = (question: string): string => {
    const q = question.toLowerCase();
    const coteMatch = q.match(/(p\d{4,8}|b\d{4,8})/);
    if (coteMatch && data) {
      const coteUpper = coteMatch[1].toUpperCase();
      const c = data.cotes.find((c: any) => c.cote === coteUpper);
      if (c) {
        let r = `${c.cote} — ${c.estado === 'RETORNO' ? 'RETORNO DE CHINA' : c.estado}\n\n`;
        r += `Stock: ${c.stockCajas.toLocaleString('es-UY')} cajas (${c.stockPallets} pallets, ${c.stockKg.toLocaleString('es-UY')} kg)\n`;
        r += `Ingreso: ${c.ingresoCajas > 0 ? c.ingresoCajas.toLocaleString('es-UY') + ' cajas' : 'SIN REGISTRO'}\n`;
        r += `Export: ${c.expRefCajas > 0 ? c.expRefCajas.toLocaleString('es-UY') + ' cajas en ' + c.expRefCount + ' export.' : '0'}\n`;
        r += `Diff: ${c.diff !== null ? (c.diff > 0 ? '+' : '') + c.diff.toLocaleString('es-UY') : 'N/A'} cajas\n`;
        if (c.causaDiff) r += `Causa: ${c.causaDiffDesc}\n`;
        if (c.stockContenedores.length > 0) r += `Contenedores: ${c.stockContenedores.join(', ')}\n`;
        return r;
      }
      return `No encontré ${coteUpper} en stock.`;
    }
    if (q.includes('diferencia') || q.includes('diff') || q.includes('descuadre')) {
      const conDiff = data.cotes.filter((c: any) => c.diff !== null && c.diff !== 0).sort((a:any,b:any) => Math.abs(b.diff) - Math.abs(a.diff));
      return `Hay ${conDiff.length} COTEs con diferencia.\n\nTOP 8:\n${conDiff.slice(0,8).map((c:any) => `• ${c.cote}: ${c.diff>0?'+':''}${c.diff} — ${c.causaDiffDesc}`).join('\n')}`;
    }
    if (q.includes('retorno') && data) {
      const r = data.cotes.filter((c:any) => c.isRetorno);
      return `Hay ${r.length} retornos de China (${r.reduce((s:number,c:any)=>s+c.stockCajas,0).toLocaleString('es-UY')} cajas). Son pallets que volvieron del puerto y no están en el archivo de ingresos.`;
    }
    if (q.includes('sin ingreso') && data) {
      const s = data.cotes.filter((c:any) => c.ingresoCajas === 0);
      return `Hay ${s.length} COTEs sin ingreso: ${s.map((c:any)=>c.cote).join(', ')}. Podés añadirles ingreso manual con el botón verde "+" en la columna Ingreso.`;
    }
    return `Pregunta: "${question}"\n\n${data ? `Datos: ${data.cotes.length} COTEs, ${stats.conDiff} con diff, ${stats.diffZero} OK.` : 'Sin datos.'} Probá: "mayores diferencias", "retornos", "sin ingreso", o un COTE específico como "P14722".`;
  };

  const askAI = async (question: string) => {
    if (!data) return;
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: question }]);

    // Try Puter.js (GPT-4o-mini free)
    if (puterReady && window.puter?.ai?.chat) {
      try {
        const context = buildContext();
        const response = await window.puter.ai.chat([
          { role: 'system', content: context },
          ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: question }
        ], { model: 'gpt-4o-mini' });
        const answer = response?.message?.content || response?.message || 'No pude procesar la consulta.';
        setMessages(prev => [...prev, { role: 'assistant', content: typeof answer === 'string' ? answer : JSON.stringify(answer) }]);
        setLoading(false);
        return;
      } catch (err) {
        console.warn('Puter AI failed, using local analysis:', err);
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
        <span className="absolute -top-1 -right-1 bg-emerald-400 rounded-full h-3 w-3 border-2 border-violet-600"></span>
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
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1 hover:bg-violet-700 rounded transition-colors"
            onClick={() => setMinimized(!minimized)}
            title={minimized ? "Maximizar" : "Minimizar"}
          >
            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            className="p-1 hover:bg-red-500 rounded transition-colors"
            onClick={() => { setOpen(false); setMinimized(false); }}
            title="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body (hidden when minimized) */}
      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 min-h-[300px] max-h-[400px]">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Hola! Soy tu asistente de trazabilidad</p>
                <p className="text-xs mt-1">{puterReady ? 'Conectado a GPT-4o-mini' : 'Análisis local activo'}</p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {['¿Cuáles son los COTEs con mayor diferencia?', '¿Qué son los retornos?', '¿Qué COTEs no tienen ingreso?', '¿Por qué P14722 tiene diff?', 'Dame un resumen general'].map(q => (
                    <button
                      key={q}
                      className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                      onClick={() => askAI(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-white border text-slate-700'}`}>
                    {msg.content}
                  </div>
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
          </div>
          {/* Input */}
          <div className="p-3 border-t bg-white rounded-b-lg">
            <div className="flex gap-2">
              <Input
                placeholder="Hacé tu pregunta..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                disabled={loading}
                className="text-sm"
              />
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
