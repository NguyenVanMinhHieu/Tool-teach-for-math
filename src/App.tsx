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

interface Problem {
  id: string;
  title: string;
  category: string;
  text: string;
  choices: Choice[];
  tikz: string;
  visualType: 'table' | 'geometry' | 'xyz';
  svgPreview: React.ReactNode;
}

const PROBLEMS_LIBRARY: Problem[] = [
  {
    id: 'p1',
    title: 'Khảo sát hàm số',
    category: 'Giải tích 12',
    text: 'Cho hàm số $y = f(x)$ có bảng biến thiên như sau. Mệnh đề nào sau đây đúng?',
    choices: [
      { id: 'a', text: 'Hàm số đồng biến trên $(-\\infty; 3)$', isTrue: false, solution: 'Khoảng này chứa cả đồng và nghịch biến. (Sai)' },
      { id: 'b', text: 'Hàm số đồng biến trên $(-1; 3)$', isTrue: false, solution: 'Chứa điểm đổi dấu. (Sai)' },
      { id: 'c', text: 'Hàm số nghịch biến trên $(-2; 0)$', isTrue: true, solution: 'Trên $(-2; 0)$, $f\'(x) < 0$. (Đúng)' },
      { id: 'd', text: 'Hàm số nghịch biến trên $(-2; 2)$', isTrue: false, solution: 'Chứa khoảng đồng biến $(0; 2)$. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n    \\tkzTabInit[lgt=1, espcl=2]{$x$ / 0.7, $f'(x)$ / 0.7, $f(x)$ / 1.5}{$-\\infty$, $-2$, $0$, $2$, $+\\infty$}\n    \\tkzTabLine{,+,z,-,z,+,z,-,}\n    \\tkzTabVar{-/ $-\\infty$, +/ 3, -/ -1, +/ 3, -/ $-\\infty$}\n\\end{tikzpicture}`,
    visualType: 'table',
    svgPreview: (
      <svg viewBox="0 0 450 180" className="w-full min-w-[400px] h-auto p-4 font-mono text-ink">
        <line x1="10" y1="45" x2="440" y2="45" stroke="#D1D1CB" strokeWidth="1" />
        <line x1="10" y1="85" x2="440" y2="85" stroke="#D1D1CB" strokeWidth="1" />
        <line x1="80" y1="10" x2="80" y2="170" stroke="#D1D1CB" strokeWidth="2" />
        <text x="35" y="32" fontSize="14" fill="currentColor" textAnchor="middle" fontWeight="bold">x</text>
        <text x="35" y="70" fontSize="14" fill="currentColor" textAnchor="middle" fontWeight="bold">f'(x)</text>
        <text x="35" y="130" fontSize="14" fill="currentColor" textAnchor="middle" fontWeight="bold">f(x)</text>
        {[
          { x: 100, val: '-∞' }, { x: 180, val: '-2', line: true }, { x: 260, val: '0', line: true },
          { x: 340, val: '2', line: true }, { x: 420, val: '+∞' }
        ].map((item, i) => (
          <g key={i}>
            <text x={item.x} y={32} fontSize="12" fill="currentColor" textAnchor="middle">{item.val}</text>
            {item.line && <line x1={item.x} y1="45" x2={item.x} y2="170" stroke="#D1D1CB" strokeDasharray="4 4" opacity="0.5" />}
          </g>
        ))}
        {[{ x: 140, s: '+' }, { x: 180, s: '0' }, { x: 220, s: '-' }, { x: 260, s: '0' }, { x: 300, s: '+' }, { x: 340, s: '0' }, { x: 380, s: '-' }].map((item, i) => (
          <text key={i} x={item.x} y={70} fontSize="14" textAnchor="middle">{item.s}</text>
        ))}
        <path d="M 100 160 L 175 105 M 185 105 L 255 155 M 265 155 L 335 105 M 345 105 L 420 160" fill="none" stroke="#2D5D7B" strokeWidth="1.5" />
        <text x="100" y="170" fontSize="12" textAnchor="middle">-∞</text>
        <text x="180" y="100" fontSize="12" textAnchor="middle">3</text>
        <text x="260" y="165" fontSize="12" textAnchor="middle">-1</text>
        <text x="340" y="100" fontSize="12" textAnchor="middle">3</text>
        <text x="420" y="170" fontSize="12" textAnchor="middle">-∞</text>
      </svg>
    )
  },
  {
    id: 'p2',
    title: 'Tọa độ Oxyz',
    category: 'Hình học 12',
    text: 'Trong không gian Oxyz, cho mặt cầu $(S): (x-1)^2 + (y+2)^2 + z^2 = 9$. Tâm $I$ và bán kính $R$ của mặt cầu là:',
    choices: [
      { id: 'a', text: '$I(1; -2; 0), R=3$', isTrue: true, solution: 'Dựa vào phương trình mặt cầu loại 1: $(x-a)^2+(y-b)^2+(z-c)^2=R^2$ ta có $a=1, b=-2, c=0, R=\\sqrt{9}=3$. (Đúng)' },
      { id: 'b', text: '$I(-1; 2; 0), R=3$', isTrue: false, solution: 'Sai dấu tọa độ tâm. (Sai)' },
      { id: 'c', text: '$I(1; -2; 0), R=9$', isTrue: false, solution: 'Bán kính chưa lấy căn bậc hai. (Sai)' },
      { id: 'd', text: '$I(-1; 2; 0), R=9$', isTrue: false, solution: 'Sai cả tâm và bán kính. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (3,0) node[right] {$y$};\n  \\draw[->] (0,0) -- (0,3) node[above] {$z$};\n  \\draw[->] (0,0) -- (-1.5,-1.5) node[below left] {$x$};\n  \\fill[blue!20, opacity=0.5] (0,0) circle (1.5);\n  \\draw (0,0) circle (1.5);\n  \\draw (-1.5,0) arc (180:360:1.5 and 0.5);\n  \\draw[dashed] (1.5,0) arc (0:180:1.5 and 0.5);\n  \\node at (0,0) {$\\cdot$}; \\node[below right] at (0,0) {$I$};\n\\end{tikzpicture}`,
    visualType: 'xyz',
    svgPreview: (
      <svg viewBox="0 0 300 300" className="w-full h-auto p-4">
        {/* Axes */}
        <line x1="150" y1="150" x2="250" y2="150" stroke="currentColor" strokeWidth="1" />
        <line x1="150" y1="150" x2="150" y2="50" stroke="currentColor" strokeWidth="1" />
        <line x1="150" y1="150" x2="80" y2="220" stroke="currentColor" strokeWidth="1" />
        <text x="255" y="150" fontSize="12" fill="currentColor">y</text>
        <text x="150" y="45" fontSize="12" fill="currentColor" textAnchor="middle">z</text>
        <text x="75" y="230" fontSize="12" fill="currentColor">x</text>
        {/* Sphere visualization */}
        <circle cx="150" cy="150" r="60" fill="#2D5D7B" fillOpacity="0.1" stroke="#2D5D7B" strokeWidth="1.5" />
        <ellipse cx="150" cy="150" rx="60" ry="20" fill="none" stroke="#2D5D7B" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="150" cy="150" r="2" fill="currentColor" />
        <text x="155" y="165" fontSize="12" fill="currentColor">I(1, -2, 0)</text>
      </svg>
    )
  },
  {
    id: 'p3',
    title: 'Khối đa diện',
    category: 'Hình học 12',
    text: 'Cho hình chóp $S.ABC$ có đáy $ABC$ là tam giác đều cạnh $a$, $SA$ vuông góc với mặt phẳng đáy và $SA = a\\sqrt{3}$. Tính thể tích $V$ của khối chóp $S.ABC$.',
    choices: [
      { id: 'a', text: '$V = \\frac{a^3}{4}$', isTrue: true, solution: '$S_{ABC} = \\frac{a^2\\sqrt{3}}{4}$. Chiều cao $h=a\\sqrt{3}$. $V = \\frac{1}{3} S.h = \\frac{1}{3} \\frac{a^2\\sqrt{3}}{4} a\\sqrt{3} = \\frac{a^3}{4}$. (Đúng)' },
      { id: 'b', text: '$V = \\frac{a^3}{2}$', isTrue: false, solution: 'Tính sai công thức thể tích. (Sai)' },
      { id: 'c', text: '$V = a^3$', isTrue: false, solution: 'Chưa chia cho 3. (Sai)' },
      { id: 'd', text: '$V = \\frac{a^3\\sqrt{3}}{12}$', isTrue: false, solution: 'Nhầm lẫn trong tính toán. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n  \\path (0,3) coordinate (S) (-1,0) coordinate (A) (2,0) coordinate (C) (0.5,-1) coordinate (B);\n  \\draw (S)--(A)--(B)--(C)--(S)--(B);\n  \\draw[dashed] (A)--(C);\n  \\node[above] at (S) {$S$};\n  \\node[left] at (A) {$A$};\n  \\node[below] at (B) {$B$};\n  \\node[right] at (C) {$C$};\n\\end{tikzpicture}`,
    visualType: 'geometry',
    svgPreview: (
      <svg viewBox="0 0 300 250" className="w-full h-auto p-4">
        <path d="M 150 240 L 80 180 L 150 20 L 220 180 Z M 150 20 L 150 240 M 150 20 L 80 180" fill="none" stroke="#2D5D7B" strokeWidth="1.5" />
        <line x1="80" y1="180" x2="220" y2="180" stroke="#D1D1CB" strokeWidth="1" strokeDasharray="4 4" />
        <text x="150" y="15" fontSize="14" fill="currentColor" textAnchor="middle">S</text>
        <text x="75" y="190" fontSize="14" fill="currentColor">A</text>
        <text x="225" y="190" fontSize="14" fill="currentColor">C</text>
        <text x="150" y="255" fontSize="14" fill="currentColor" textAnchor="middle">B</text>
      </svg>
    )
  },
  {
    id: 'p4',
    title: 'Góc giữa đường thẳng và mặt phẳng',
    category: 'Hình học 11-12',
    text: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$. $SA \\perp (ABCD)$ và $SA = a\\sqrt{2}$. Góc giữa đường thẳng $SC$ và mặt phẳng $(ABCD)$ là:',
    choices: [
      { id: 'a', text: '$30^\\circ$', isTrue: false, solution: 'Tan của góc là $SA/AC = a\\sqrt{2}/(a\\sqrt{2}) = 1$. (Sai)' },
      { id: 'b', text: '$45^\\circ$', isTrue: true, solution: '$AC = a\\sqrt{2}$. $\\tan(\\widehat{SCA}) = \\frac{SA}{AC} = \\frac{a\\sqrt{2}}{a\\sqrt{2}} = 1 \\Rightarrow \\widehat{SCA} = 45^\\circ$. (Đúng)' },
      { id: 'c', text: '$60^\\circ$', isTrue: false, solution: 'Tính nhầm tỉ số tan. (Sai)' },
      { id: 'd', text: '$90^\\circ$', isTrue: false, solution: 'Không thể là 90 độ. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n  \\path (0,0) coordinate (A) (3,0) coordinate (D) (1,1) coordinate (B) (4,1) coordinate (C) (0,3) coordinate (S);\n  \\draw (S)--(A)--(D)--(C)--(S)--(D);\n  \\draw[dashed] (S)--(B)--(C) (A)--(B);\n  \\draw[dashed, red] (S)--(C) (A)--(C);\n\\end{tikzpicture}`,
    visualType: 'geometry',
    svgPreview: (
      <svg viewBox="0 0 300 250" className="w-full h-auto p-4">
        <path d="M 50 200 L 150 200 L 200 150 L 50 40 L 50 200 L 200 150" fill="none" stroke="#2D5D7B" strokeWidth="1.5" />
        <path d="M 50 40 L 150 200" fill="none" stroke="#2D5D7B" strokeWidth="1.5" />
        <line x1="50" y1="200" x2="100" y2="150" stroke="#D1D1CB" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="100" y1="150" x2="200" y2="150" stroke="#D1D1CB" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="100" y1="150" x2="50" y2="40" stroke="#D1D1CB" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50" y1="40" x2="200" y2="150" stroke="red" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50" y1="200" x2="200" y2="150" stroke="red" strokeWidth="1" strokeDasharray="4 4" />
        <text x="50" y="30" fontSize="14" fill="currentColor" textAnchor="middle">S</text>
        <text x="40" y="215" fontSize="14" fill="currentColor">A</text>
        <text x="155" y="215" fontSize="14" fill="currentColor">D</text>
        <text x="210" y="155" fontSize="14" fill="currentColor">C</text>
        <text x="95" y="145" fontSize="14" fill="currentColor">B</text>
      </svg>
    )
  }
];

export default function App() {
  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const currentProblem = PROBLEMS_LIBRARY[currentProblemIdx];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, 'true' | 'false' | null>>({
    a: null, b: null, c: null, d: null
  });
  const [showResults, setShowResults] = useState(false);

  // Reset answer states when problem changes
  useEffect(() => {
    setUserAnswers({ a: null, b: null, c: null, d: null });
    setShowResults(false);
    if (audioBufferSourceRef.current) {
        audioBufferSourceRef.current.stop();
        setIsPlaying(false);
    }
    setLastAudioBlob(null);
  }, [currentProblemIdx]);

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
      const prompt = `Đọc diễn cảm bài tập toán sau đây: ${currentProblem.text}. Các lựa chọn là: ${currentProblem.choices.map(c => c.text).join('. ')}`;

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
    navigator.clipboard.writeText(currentProblem.tikz);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg text-ink font-sans selection:bg-blue-100 flex flex-col">
      {/* Editorial Header */}
      <header className="px-6 md:px-10 py-6 md:py-10 flex flex-col md:flex-row justify-between items-center border-b border-border gap-6 bg-white shrink-0">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="md:hidden flex-1">
             <select 
               value={currentProblemIdx}
               onChange={(e) => setCurrentProblemIdx(parseInt(e.target.value))}
               className="w-full p-2 border border-border rounded-sm bg-paper text-xs font-serif italic"
             >
                {PROBLEMS_LIBRARY.map((p, i) => (
                  <option key={p.id} value={i}>Bài {i+1}: {p.title}</option>
                ))}
             </select>
          </div>
          <div className="hidden md:block">
            <div className="text-[12px] font-mono tracking-[0.2em] uppercase text-muted mb-2">
              Tool-teach-for-math &mdash; [Dự án 2025]
            </div>
            <div className="font-serif italic text-lg text-ink">
              Trình giải toán & Trực quan hóa TikZ
            </div>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex w-64 border-r border-border bg-paper flex-col overflow-y-auto">
           <div className="p-6 border-b border-border">
              <h2 className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted">Thư viện bài tập</h2>
           </div>
           <nav className="flex-1 p-4 space-y-2">
              {PROBLEMS_LIBRARY.map((problem, idx) => (
                <button
                  key={problem.id}
                  onClick={() => setCurrentProblemIdx(idx)}
                  className={`w-full text-left p-4 rounded-sm transition-all group ${currentProblemIdx === idx ? 'bg-ink text-white shadow-md' : 'hover:bg-paper-alt border border-transparent hover:border-border'}`}
                >
                  <p className={`text-[9px] uppercase tracking-widest mb-1 ${currentProblemIdx === idx ? 'text-white/60' : 'text-muted'}`}>{problem.category}</p>
                  <p className="font-serif italic text-[14px] leading-tight group-hover:translate-x-1 transition-transform">{problem.title}</p>
                </button>
              ))}
           </nav>
           <div className="p-6 border-t border-border mt-auto">
              <div className="p-4 bg-accent/5 rounded-sm border border-accent/10">
                 <p className="text-[10px] text-accent font-medium leading-relaxed">Chọn một bài tập từ thư viện để bắt đầu phân tích và giải.</p>
              </div>
           </div>
        </aside>

        <main className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_400px]">
          {/* Left Section: Problem & Choices & TikZ */}
          <div className="p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-border space-y-12 bg-white">
            {/* Problem Statement */}
            <section className="space-y-10">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-ink text-white text-[10px] font-mono rounded-full uppercase tracking-tighter">Bài #{currentProblemIdx + 1}</span>
                  <div className="h-px flex-1 bg-border"></div>
                </div>
                
                <h1 className="font-serif text-3xl leading-[1.4] text-ink max-w-3xl">
                  <span className="editorial-math-bg">
                    <FormattedMath text={currentProblem.text} />
                  </span>
                </h1>
                
                {/* Visual Preview */}
                <div className="max-w-xl mx-auto md:mx-0 bg-white border border-border p-6 rounded-xs shadow-sm ring-1 ring-ink/5 overflow-hidden">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted mb-4 border-b border-border/50 pb-2 flex justify-between items-center">
                    <span>Trực quan hóa mô phỏng</span>
                    <span className="italic text-[9px] lowercase font-normal">Chế độ: {currentProblem.visualType}</span>
                  </div>
                  <div className="relative overflow-x-auto rounded-xs border border-border/10">
                    {currentProblem.svgPreview}
                  </div>
                </div>
              </div>
            </section>

            {/* Interactive Choices Grid */}
            <section className="space-y-6 pt-12 border-t border-border/30">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted flex items-center gap-2">
                  <span className="h-[1px] w-6 bg-border"></span>
                  Trắc nghiệm Đúng/Sai
                </div>
                <button 
                  onClick={() => setShowResults(!showResults)}
                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent hover:underline flex items-center gap-2"
                >
                  {showResults && <Check size={12}/>}
                  {showResults ? 'Ẩn đáp án' : 'Hiện đáp án'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {currentProblem.choices.map((choice, idx) => (
                  <div key={choice.id} className="flex flex-col md:flex-row md:items-center gap-4 p-6 bg-paper rounded-xs border border-border group hover:shadow-sm transition-all">
                    <div className="flex-1 text-[15px] leading-relaxed text-ink/90 italic font-serif">
                      <span className="font-bold mr-2 uppercase text-muted font-sans text-xs">{choice.id})</span>
                      <FormattedMath text={choice.text} />
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAnswer(choice.id, 'true')}
                        className={`px-4 py-1.5 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${userAnswers[choice.id] === 'true' ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-ink hover:text-ink'}`}
                      >
                        Đúng
                      </button>
                      <button 
                        onClick={() => handleAnswer(choice.id, 'false')}
                        className={`px-4 py-1.5 text-[9px] uppercase font-bold tracking-widest border rounded-sm transition-all ${userAnswers[choice.id] === 'false' ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-ink hover:text-ink'}`}
                      >
                        Sai
                      </button>
                      
                      <AnimatePresence>
                        {showResults && (
                          <motion.div 
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`ml-2 px-3 py-1.5 text-[9px] uppercase font-bold rounded-sm flex items-center gap-1.5 ${choice.isTrue ? 'bg-green-100 text-true' : 'bg-red-100 text-false'}`}
                          >
                            {choice.isTrue ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                            {choice.isTrue ? 'Đ' : 'S'}
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
                   Mã nguồn TikZ (Preamble: {'\\usepackage{tkz-tab, tikz-3dplot}'})
                 </div>
                 <button 
                  onClick={copyToClipboard}
                  className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink flex items-center gap-2 underline underline-offset-4"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copied ? 'Copied Code' : 'Copy TikZ Code'}
                </button>
               </div>
               
               <div className="w-full bg-ink p-8 rounded-xs text-[12px] font-mono text-white/70 overflow-hidden relative shadow-2xl">
                  <div className="absolute top-0 right-0 p-4 text-white/5"><Code size={24} /></div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar pr-4">
                    <pre className="whitespace-pre-wrap leading-relaxed">{currentProblem.tikz}</pre>
                  </div>
               </div>
            </section>
          </div>

          {/* Right Section: Detailed Solution */}
          <aside className="bg-paper-alt p-8 md:p-12 overflow-y-auto border-l border-border">
            <div className="flex items-center gap-4 mb-10 group">
               <h2 className="font-serif italic text-2xl text-accent">Lời giải đầy đủ</h2>
               <div className="h-px flex-1 bg-border group-hover:bg-accent/40 transition-colors"></div>
            </div>
            
            <div className="space-y-8">
              {currentProblem.choices.map((choice) => (
                <div key={choice.id} className="group border-b border-border/50 pb-8 last:border-0 relative">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-bold text-[10px] text-muted uppercase tracking-[0.2em]">
                      Ý {choice.id.toUpperCase()})
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-sm ${choice.isTrue ? 'text-true bg-true/5' : 'text-false bg-false/5'}`}>
                      {choice.isTrue ? 'Đúng' : 'Sai'}
                    </span>
                  </div>
                  <div className="text-[14px] leading-[1.8] text-muted group-hover:text-ink transition-colors font-serif italic pr-4">
                    <FormattedMath text={choice.solution} />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>

      {/* Editorial Footer */}
      <footer className="px-10 py-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-muted bg-paper">
        <div>Trang {currentProblemIdx + 1} / {PROBLEMS_LIBRARY.length} &bull; Phối hợp: AI Studio Visualizer</div>
        <div className="flex gap-4">
          <span className="px-3 py-1 border border-border rounded-full cursor-help">Phân loại: {currentProblem.category}</span>
          <span className="px-3 py-1 border border-border rounded-full">ID: {currentProblem.id}</span>
        </div>
      </footer>
    </div>
  );
}
