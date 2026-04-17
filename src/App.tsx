import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Play, 
  Pause, 
  Volume2, 
  Code, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Info,
  ChevronRight,
  Maximize2,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Components
const FormattedMath = ({ text }: { text: string }) => {
  if (!text) return null;
  // This splits the text into parts that are between $ and parts that are not
  const parts = text.split(/(\$.*?\$)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

// Types
interface Choice {
  id: string;
  text: string;
  isTrue: boolean;
  solution: string;
}

const choicesData: Choice[] = [
  { 
    id: 'a', 
    text: 'Hàm số đồng biến trên khoảng $(-\\infty; 3)$', 
    isTrue: false,
    solution: 'Dựa vào bảng biến thiên, trên khoảng $(-\\infty; -2)$ hàm số đồng biến, nhưng trên khoảng $(-2; 0)$ hàm số nghịch biến. Khoảng $(-\\infty; 3)$ chứa cả khoảng đồng biến và nghịch biến. (Sai)'
  },
  { 
    id: 'b', 
    text: 'Hàm số đồng biến trên khoảng $(-1; 3)$', 
    isTrue: false,
    solution: 'Khoảng $(-1; 3)$ chứa điểm $x=0$ và $x=2$. Ta thấy trên $(-1; 0)$ hàm số nghịch biến, trên $(0; 2)$ đồng biến, và trên $(2; 3)$ nghịch biến. (Sai)'
  },
  { 
    id: 'c', 
    text: 'Hàm số nghịch biến trên khoảng $(-2; 0)$', 
    isTrue: true,
    solution: 'Dựa vào hàng $f\'(x)$, ta thấy trên khoảng $(-2; 0)$ thì $f\'(x)$ mang dấu âm $(-)$. Do đó hàm số nghịch biến trên khoảng $(-2; 0)$. (Đúng)'
  },
  { 
    id: 'd', 
    text: 'Hàm số nghịch biến trên khoảng $(-2; 2)$', 
    isTrue: false,
    solution: 'Trên khoảng $(-2; 0)$ hàm số nghịch biến, nhưng trên khoảng $(0; 2)$ hàm số lại đồng biến ($f\'(x) > 0$). (Sai)'
  },
];

const exerciseText = `Cho hàm số $y = f(x)$ có bảng biến thiên như sau. Mệnh đề nào sau đây đúng?`;

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, 'true' | 'false' | null>>({
    a: null, b: null, c: null, d: null
  });
  const [showResults, setShowResults] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Utility to create a valid WAV file from raw PCM data
  const createWavBlob = (pcmData: Uint8Array, sampleRate: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byteRate
    view.setUint16(32, 2, true); // blockAlign
    view.setUint16(34, 16, true); // bitsPerSample
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);
    return new Blob([header, pcmData], { type: 'audio/wav' });
  };

  const tikzCode = `\\begin{tikzpicture}
    \\tkzTabInit[lgt=1, espcl=2]
    {$x$ / 0.7, $f'(x)$ / 0.7, $f(x)$ / 1.5}%
    {$-\\infty$, $-2$, $0$, $2$, $+\infty$}%
    \\tkzTabLine{,+,z,-,z,+,z,-,}%
    \\tkzTabVar{-/ $-\\infty$, +/ 3, -/ -1, +/ 3, -/ $-\\infty$}%
\\end{tikzpicture}`;

  const handleTTS = async () => {
    if (isPlaying) {
      if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop();
        setIsPlaying(false);
      }
      return;
    }

    if (isSynthesizing) return;

    try {
      setIsSynthesizing(true);
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const prompt = `Đọc diễn cảm bài tập toán sau đây: ${exerciseText}. Các lựa chọn là: ${choicesData.map(c => c.text).join('. ')}`;

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const wavBlob = createWavBlob(bytes, 24000);
        setLastAudioBlob(wavBlob);

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const audioContext = audioContextRef.current;
        const floatData = new Float32Array(bytes.length / 2);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < floatData.length; i++) {
          const sample = view.getInt16(i * 2, true);
          floatData[i] = sample / 32768;
        }

        const audioBuffer = audioContext.createBuffer(1, floatData.length, 24000);
        audioBuffer.getChannelData(0).set(floatData);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        
        audioBufferSourceRef.current = source;
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleAnswer = (id: string, answer: 'true' | 'false') => {
    setUserAnswers(prev => ({ ...prev, [id]: answer }));
  };

  const downloadAudio = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bai-tap-oxyz.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tikzCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans selection:bg-blue-100 flex flex-col">
      {/* Editorial Header */}
      <header className="px-10 py-10 flex flex-col md:flex-row justify-between items-baseline border-b border-border gap-6">
        <div>
          <div className="text-[12px] font-mono tracking-[0.2em] uppercase text-muted mb-2">
            Công cụ dạy-học Toán &mdash; [Dự án 2025]
          </div>
          <div className="font-serif italic text-lg text-ink">
            Trình giải toán & Trực quan hóa TikZ
          </div>
        </div>
        
        <div className="flex gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleTTS}
            disabled={isSynthesizing}
            className={`flex items-center gap-2 px-4 py-2 border border-border rounded-sm text-[10px] font-mono uppercase tracking-widest hover:bg-ink hover:text-white transition-colors h-fit ${isSynthesizing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSynthesizing ? 'Synthesizing...' : isPlaying ? <><Pause size={14}/> Stop</> : <><Volume2 size={14}/> Listen</>}
          </motion.button>

          <AnimatePresence>
            {lastAudioBlob && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={downloadAudio}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-sm text-[10px] font-mono uppercase tracking-widest hover:bg-accent/90 transition-colors h-fit"
              >
                Download Voice
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_400px]">
        {/* Left Section: Problem & Choices & TikZ */}
        <div className="p-8 md:p-12 border-b md:border-b-0 md:border-r border-border space-y-12">
          {/* Problem Statement */}
          <section className="space-y-10">
            <div className="space-y-4">
              <h1 className="font-serif text-3xl leading-[1.5] text-ink max-w-3xl">
                <span className="editorial-math-bg">
                  <FormattedMath text={exerciseText} />
                </span>
              </h1>
              
              {/* Variations Table Visualization */}
              <div className="max-w-2xl bg-paper-alt border border-border p-6 rounded-xs shadow-sm shadow-ink/5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted mb-4 border-b border-border/50 pb-2">
                  Bảng biến thiên mẫu (Sử dụng tkz-tab)
                </div>
                <div className="relative overflow-x-auto bg-white rounded-xs border border-border/50 shadow-inner">
                  <svg viewBox="0 0 450 180" className="w-full min-w-[400px] h-auto p-4 font-mono text-ink">
                    {/* Rows Definition */}
                    <line x1="10" y1="45" x2="440" y2="45" stroke="#D1D1CB" strokeWidth="1" />
                    <line x1="10" y1="85" x2="440" y2="85" stroke="#D1D1CB" strokeWidth="1" />
                    <line x1="80" y1="10" x2="80" y2="170" stroke="#D1D1CB" strokeWidth="2" />
                    
                    {/* Labels */}
                    <text x="35" y="32" fontSize="14" fill="currentColor" textAnchor="middle" fontWeight="bold">x</text>
                    <text x="35" y="70" fontSize="14" fill="currentColor" textAnchor="middle" fontWeight="bold">f'(x)</text>
                    <text x="35" y="130" fontSize="14" fill="currentColor" textAnchor="middle" fontWeight="bold">f(x)</text>
                    
                    {/* X Values & Vertical Lines */}
                    {[
                      { x: 100, val: '-∞' },
                      { x: 180, val: '-2', line: true },
                      { x: 260, val: '0', line: true },
                      { x: 340, val: '2', line: true },
                      { x: 420, val: '+∞' }
                    ].map((item, i) => (
                      <g key={i}>
                        <text x={item.x} y={32} fontSize="12" fill="currentColor" textAnchor="middle">{item.val}</text>
                        {item.line && (
                          <line x1={item.x} y1="45" x2={item.x} y2="170" stroke="#D1D1CB" strokeDasharray="4 4" opacity="0.5" />
                        )}
                      </g>
                    ))}
                    
                    {/* f' Signs */}
                    {[
                      { x: 140, sign: '+' },
                      { x: 180, sign: '0' },
                      { x: 220, sign: '-' },
                      { x: 260, sign: '0' },
                      { x: 300, sign: '+' },
                      { x: 340, sign: '0' },
                      { x: 380, sign: '-' }
                    ].map((item, i) => (
                      <text key={i} x={item.x} y={70} fontSize="14" fill="currentColor" textAnchor="middle" fontWeight={item.sign === '0' ? 'bold' : 'normal'}>
                        {item.sign}
                      </text>
                    ))}
                    
                    {/* f(x) Variations */}
                    {/* Arrows */}
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orientation="auto">
                        <polygon points="0 0, 6 2, 0 4" fill="#2D5D7B" />
                      </marker>
                    </defs>
                    
                    {/* Arrow path: -inf -> 3 -> -1 -> 3 -> -inf */}
                    <path d="M 100 160 L 175 105" fill="none" stroke="#2D5D7B" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                    <path d="M 185 105 L 255 155" fill="none" stroke="#2D5D7B" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                    <path d="M 265 155 L 335 105" fill="none" stroke="#2D5D7B" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                    <path d="M 345 105 L 420 160" fill="none" stroke="#2D5D7B" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                    
                    {/* Y Values */}
                    <text x="100" y="170" fontSize="12" fill="black" textAnchor="middle">-∞</text>
                    <text x="180" y="100" fontSize="12" fill="black" textAnchor="middle" fontWeight="bold">3</text>
                    <text x="260" y="165" fontSize="12" fill="black" textAnchor="middle" fontWeight="bold">-1</text>
                    <text x="340" y="100" fontSize="12" fill="black" textAnchor="middle" fontWeight="bold">3</text>
                    <text x="420" y="170" fontSize="12" fill="black" textAnchor="middle">-∞</text>
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* New Interactive Choices Grid */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted flex items-center gap-2">
                <span className="h-[1px] w-6 bg-border"></span>
                Trắc nghiệm Đúng/Sai
              </div>
              <button 
                onClick={() => setShowResults(!showResults)}
                className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent hover:underline"
              >
                {showResults ? 'Ẩn đáp án' : 'Hiện đáp án'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {choicesData.map((choice, idx) => (
                <div key={choice.id} className="flex flex-col md:flex-row md:items-center gap-4 p-6 bg-white border border-border rounded-xs group">
                  <div className="flex-1 text-[15px] leading-relaxed text-ink/90 italic font-serif">
                    <span className="font-bold mr-2 uppercase">{choice.id})</span>
                    <FormattedMath text={choice.text} />
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAnswer(choice.id, 'true')}
                      className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${userAnswers[choice.id] === 'true' ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'}`}
                    >
                      Đúng
                    </button>
                    <button 
                      onClick={() => handleAnswer(choice.id, 'false')}
                      className={`px-3 py-1 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${userAnswers[choice.id] === 'false' ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-accent'}`}
                    >
                      Sai
                    </button>
                    
                    <AnimatePresence>
                      {showResults && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`ml-2 px-3 py-1 text-[9px] uppercase font-bold rounded-sm ${choice.isTrue ? 'bg-green-100 text-true' : 'bg-red-100 text-false'}`}
                        >
                          {choice.isTrue ? 'Kết quả: Đ' : 'Kết quả: S'}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TikZ Visual (Code only) */}
          <section className="pt-12 border-t border-border">
             <div className="flex items-end justify-between mb-8">
               <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted flex items-center gap-2">
                 <span className="h-[1px] w-6 bg-border"></span>
                 Mã nguồn TikZ (Preamble: {'\\usepackage{tkz-tab}'})
               </div>
               <button 
                onClick={copyToClipboard}
                className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink flex items-center gap-2 underline underline-offset-4"
              >
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                {copied ? 'Copied Code' : 'Copy TikZ Code'}
              </button>
             </div>
             
             <div className="w-full bg-ink p-6 rounded-xs text-[11px] font-mono text-white/70 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-3 text-white/10"><Code size={16} /></div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  <pre className="whitespace-pre-wrap">{tikzCode}</pre>
                </div>
             </div>
          </section>
        </div>

        {/* Right Section: Detailed Solution */}
        <aside className="bg-paper-alt p-8 md:p-12 md:sticky md:top-0 h-fit border-l border-border">
          <div className="flex items-center gap-4 mb-10 group">
             <h2 className="font-serif italic text-2xl text-accent">Lời giải đầy đủ</h2>
             <div className="h-px flex-1 bg-border group-hover:bg-accent/40 transition-colors"></div>
          </div>
          
          <div className="space-y-10">
            {choicesData.map((choice) => (
              <div key={choice.id} className="group border-b border-border/50 pb-6 last:border-0">
                <span className="block font-bold text-[10px] text-ink uppercase tracking-[0.2em] mb-4 opacity-60 flex items-center justify-between">
                  Ý {choice.id.toUpperCase()}) 
                  <span className={`${choice.isTrue ? 'text-true bg-green-50' : 'text-false bg-red-50'} px-2 rounded-sm tracking-normal font-sans text-[8px]`}>
                    {choice.isTrue ? 'Đúng' : 'Sai'}
                  </span>
                </span>
                <div className="text-[13px] leading-relaxed text-muted group-hover:text-ink transition-colors">
                  <FormattedMath text={choice.solution} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>

      {/* Editorial Footer */}
      <footer className="px-10 py-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-muted">
        <div>Trang 1 / 1 &bull; Phối hợp: AI Studio Visualizer</div>
        <div className="flex gap-4">
          <span className="px-3 py-1 border border-border rounded-full cursor-help">Phân loại: Hình học 12</span>
          <span className="px-3 py-1 border border-border rounded-full">ID: Oxyz-Quiz-01</span>
        </div>
      </footer>
    </div>
  );
}
