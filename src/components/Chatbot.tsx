'use client';

import { useEffect, useState, useRef } from 'react';
import { Send, Download, CheckCircle, Loader2 } from 'lucide-react';
import { CreateMLCEngine, MLCEngineInterface } from "@mlc-ai/web-llm";

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export default function Chatbot({ biometrics }: { biometrics: any }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebLLM State
  const [engine, setEngine] = useState<MLCEngineInterface | null>(null);
  const [engineProgress, setEngineProgress] = useState<string>('');
  const [engineReady, setEngineReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  const initLocalModel = async () => {
    setModelLoading(true);
    try {
      const initProgressCallback = (initProgress: any) => {
        setEngineProgress(initProgress.text);
      };
      
      const newEngine = await CreateMLCEngine(
        "gemma-2b-it-q4f32_1-MLC",
        { initProgressCallback }
      );
      
      setEngine(newEngine);
      setEngineReady(true);
    } catch (err) {
      console.error("Failed to initialize WebLLM engine", err);
      setEngineProgress("Failed to initialize local model.");
    } finally {
      setModelLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, engineProgress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !engine) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', content: '' }]);

    const systemInstruction = `You are an elite ISA Certified Arborist holding a TRAQ qualification. Review the provided tree biometrics. Deliver a concise, professional structural risk assessment. Highlight biomechanical red flags such as excessive lean angles or poor live crown ratios.\nCurrent Tree Biometrics: ${JSON.stringify(biometrics)}`;

    try {
      const chatMessages = [
        { role: 'system' as const, content: systemInstruction },
        ...newMessages.map(m => ({ 
          role: m.role === 'user' ? 'user' as const : 'assistant' as const, 
          content: m.content 
        }))
      ];

      const stream = await engine.chat.completions.create({
        messages: chatMessages,
        temperature: 0.7,
        stream: true
      });

      let text = '';
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          text += chunk.choices[0].delta.content;
          setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: text } : m));
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: 'Connection error or stream interrupted: ' + err.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] md:h-full bg-transparent overflow-hidden border-t md:border-t-0 border-main">
      <div className="px-4 py-2 bg-emerald-950/30 border-b border-main flex items-center justify-between shrink-0">
        <span className="text-[10px] font-black uppercase text-emerald-500 tracking-tighter">Local AI / WebLLM</span>
        <div className="flex gap-1 items-center">
          {engineReady ? (
            <>
              <CheckCircle size={10} className="text-emerald-500" />
              <span className="text-[8px] text-emerald-500 uppercase font-mono">Gemma Ready</span>
            </>
          ) : (
             <span className="text-[8px] text-slate-500 uppercase font-mono">Offline</span>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!engineReady && !modelLoading && (
          <div className="flex flex-col items-center justify-center h-full opacity-80 space-y-4 p-4">
            <span className="text-4xl shadow-emerald-500/20 drop-shadow-2xl">🧠</span>
            <div className="text-center text-slate-300 text-xs font-mono max-w-[90%] leading-relaxed bg-slate-900 border border-slate-700/60 p-4 rounded-lg shadow-inner">
               <p className="mb-2">Local Gemma Model (web-llm) required for offline analysis.</p>
               <button 
                 onClick={initLocalModel}
                 className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-[#020617] px-4 py-2 font-bold rounded flex items-center gap-2 mx-auto transition shadow-[0_0_15px_rgba(16,185,129,0.3)]"
               >
                 <Download size={14} /> Download & Init Gemma-2B
               </button>
            </div>
          </div>
        )}

        {modelLoading && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
             <Loader2 className="animate-spin text-emerald-500" size={32} />
             <div className="text-[10px] text-emerald-400 font-mono text-center max-w-[80%] break-words">
                {engineProgress || 'Loading weights...'}
             </div>
          </div>
        )}

        {messages.length === 0 && engineReady && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-3">
             <span className="text-4xl text-emerald-500 drop-shadow-md">🤖</span>
            <div className="text-center text-emerald-400 text-[11px] font-mono max-w-[80%] leading-relaxed border border-emerald-900 bg-emerald-950/20 p-4 rounded-lg">
              Local Gemma engine initialized.<br/>Waiting for queries on spatial data.
            </div>
          </div>
        )}
        
        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'model' && (
              <div className="w-6 h-6 rounded bg-emerald-600 shrink-0 flex items-center justify-center text-[10px] font-bold text-[#020617]">AI</div>
            )}
            <div 
               className={`p-3 text-[11px] leading-relaxed shadow-lg block break-words whitespace-pre-wrap
               ${m.role === 'user' 
                  ? 'bg-emerald-600 rounded-2xl rounded-tr-none text-[#020617] font-medium' 
                  : 'bg-slate-800 text-[#f8fafc] rounded-2xl rounded-tl-none'}`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-xs text-emerald-500/70 font-mono flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-main shrink-0">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={engineReady ? "Ask offline assistant..." : "Init model first..."}
            className="w-full bg-slate-900 border border-main rounded-lg py-2 pl-3 pr-10 text-xs focus:outline-none focus:border-emerald-500/50 text-[#f8fafc] disabled:opacity-50"
            disabled={isLoading || !engineReady}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim() || !engineReady}
            className="absolute right-2 top-1.5 p-1 text-emerald-500 disabled:opacity-50 hover:bg-slate-800 rounded transition"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
}
