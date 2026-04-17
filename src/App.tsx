import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Volume2, 
  CheckCircle2, 
  ChevronRight,
  Loader2,
  Table,
  HelpCircle,
  Pause,
  Play,
  Code,
  Maximize2,
  XCircle,
  PanelLeftClose,
  PanelLeftOpen,
  FileUp,
  ClipboardPaste,
  Trash2,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

// Components
const FormattedMath = ({ text }: { text: string }) => {
  if (!text) return null;
  // Regex to match $...$, \(...\), and \[...\]
  const parts = text.split(/(\$.*?\$|\\\(.*?\\\)|\\\[.*?\\\])/gs);
  return (
    <span>
      {parts.map((part, i) => {
        if ((part.startsWith('$') && part.endsWith('$'))) {
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        }
        if (part.startsWith('\\(') && part.endsWith('\\)')) {
          return <InlineMath key={i} math={part.slice(2, -2)} />;
        }
        if (part.startsWith('\\[') && part.endsWith('\\]')) {
          return <div key={i} className="my-4 text-center"><InlineMath math={part.slice(2, -2)} /></div>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TTS_MODEL = "gemini-2.5-flash-native-audio-latest"; 
const MAIN_MODEL = "gemini-flash-latest
";

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
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  choices?: Choice[];
  answer?: string;
  solution?: string;
  tikz: string;
  visualType: 'table' | 'geometry' | 'xyz';
  svgPreviewString?: string;
}

const PROBLEMS_LIBRARY: Problem[] = [
  {
    id: 'p1',
    title: 'Khảo sát hàm số',
    category: 'Giải tích 12',
    text: 'Cho hàm số $y = f(x)$ có bảng biến thiên như sau. Mệnh đề nào sau đây đúng?',
    type: 'multiple_choice',
    choices: [
      { id: 'a', text: 'Hàm số đồng biến trên $(-\\infty; 3)$', isTrue: false, solution: 'Khoảng này chứa cả đồng và nghịch biến. (Sai)' },
      { id: 'b', text: 'Hàm số đồng biến trên $(-1; 3)$', isTrue: false, solution: 'Chưa điểm đổi dấu. (Sai)' },
      { id: 'c', text: 'Hàm số nghịch biến trên $(-2; 0)$', isTrue: true, solution: 'Trên $(-2; 0)$, $f\'(x) < 0$. (Đúng)' },
      { id: 'd', text: 'Hàm số nghịch biến trên $(-2; 2)$', isTrue: false, solution: 'Chứa khoảng đồng biến $(0; 2)$. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n    \\tkzTabInit[lgt=1, espcl=2]{$x$ / 0.7, $f'(x)$ / 0.7, $f(x)$ / 1.5}{$-\\infty$, $-2$, $0$, $2$, $+\\infty$}\n    \\tkzTabLine{,+,z,-,z,+,z,-,}\n    \\tkzTabVar{-/ $-\\infty$, +/ 3, -/ -1, +/ 3, -/ $-\\infty$}\n\\end{tikzpicture}`,
    visualType: 'table'
  },
  {
    id: 'p2',
    title: 'Tọa độ Oxyz',
    category: 'Hình học 12',
    type: 'multiple_choice',
    text: 'Trong không gian Oxyz, cho mặt cầu $(S): (x-1)^2 + (y+2)^2 + z^2 = 9$. Tâm $I$ và bán kính $R$ của mặt cầu là:',
    choices: [
      { id: 'a', text: '$I(1; -2; 0), R=3$', isTrue: true, solution: 'Dựa vào phương trình mặt cầu loại 1: $(x-a)^2+(y-b)^2+(z-c)^2=R^2$ ta có $a=1, b=-2, c=0, R=\\sqrt{9}=3$. (Đúng)' },
      { id: 'b', text: '$I(-1; 2; 0), R=3$', isTrue: false, solution: 'Sai dấu tọa độ tâm. (Sai)' },
      { id: 'c', text: '$I(1; -2; 0), R=9$', isTrue: false, solution: 'Bán kính chưa lấy căn bậc hai. (Sai)' },
      { id: 'd', text: '$I(-1; 2; 0), R=9$', isTrue: false, solution: 'Sai cả tâm và bán kính. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (3,0) node[right] {$y$};\n  \\draw[->] (0,0) -- (0,3) node[above] {$z$};\n  \\draw[->] (0,0) -- (-1.5,-1.5) node[below left] {$x$};\n  \\fill[blue!20, opacity=0.5] (0,0) circle (1.5);\n  \\draw (0,0) circle (1.5);\n  \\draw (-1.5,0) arc (180:360:1.5 and 0.5);\n  \\draw[dashed] (1.5,0) arc (0:180:1.5 and 0.5);\n  \\node at (0,0) {$\\cdot$}; \\node[below right] at (0,0) {$I$};\n\\end{tikzpicture}`,
    visualType: 'xyz'
  },
  {
    id: 'p3',
    title: 'Khối đa diện',
    category: 'Hình học 12',
    type: 'multiple_choice',
    text: 'Cho hình chóp $S.ABC$ có đáy $ABC$ là tam giác đều cạnh $a$, $SA$ vuông góc với mặt phẳng đáy và $SA = a\\sqrt{3}$. Tính thể tích $V$ của khối chóp $S.ABC$.',
    choices: [
      { id: 'a', text: '$V = \\frac{a^3}{4}$', isTrue: true, solution: '$S_{ABC} = \\frac{a^2\\sqrt{3}}{4}$. Chiều cao $h=a\\sqrt{3}$. $V = \\frac{1}{3} S.h = \\frac{1}{3} \\frac{a^2\\sqrt{3}}{4} a\\sqrt{3} = \\frac{a^3}{4}$. (Đúng)' },
      { id: 'b', text: '$V = \\frac{a^3}{2}$', isTrue: false, solution: 'Tính sai công thức thể tích. (Sai)' },
      { id: 'c', text: '$V = a^3$', isTrue: false, solution: 'Chưa chia cho 3. (Sai)' },
      { id: 'd', text: '$V = \\frac{a^3\\sqrt{3}}{12}$', isTrue: false, solution: 'Nhầm lẫn trong tính toán. (Sai)' },
    ],
    tikz: `\\begin{tikzpicture}\n  \\path (0,3) coordinate (S) (-1,0) coordinate (A) (2,0) coordinate (C) (0.5,-1) coordinate (B);\n  \\draw (S)--(A)--(B)--(C)--(S)--(B);\n  \\draw[dashed] (A)--(C);\n  \\node[above] at (S) {$S$};\n  \\node[left] at (A) {$A$};\n  \\node[below] at (B) {$B$};\n  \\node[right] at (C) {$C$};\n\\end{tikzpicture}`,
    visualType: 'geometry'
  },
  {
    id: 'p5',
    title: 'Tiệm cận của hàm số',
    category: 'Giải tích 12',
    text: 'Cho hàm số $y = f(x)$ có bảng biến thiên như sau. Đồ thị của hàm số đã cho có bao nhiêu tiệm cận?',
    type: 'multiple_choice',
    choices: [
      { id: 'a', text: '0', isTrue: false, solution: 'Sai, hàm số có tiệm cận đứng và ngang.' },
      { id: 'b', text: '3', isTrue: false, solution: 'Chỉ có 2 đường tiệm cận duy nhất.' },
      { id: 'c', text: '1', isTrue: false, solution: 'Thiếu một loại tiệm cận.' },
      { id: 'd', text: '2', isTrue: true, solution: 'Tiệm cận đứng $x=2$ (do $\\lim_{x \\to 2^\\pm} y = \\pm \\infty$) và tiệm cận ngang $y=4$ (do $\\lim_{x \\to \\pm \\infty} y = 4$).' },
    ],
    tikz: `\\begin{tikzpicture}\n  \\tkzTabInit[lgt=1, espcl=3]{$x$ / 0.7, $y'$ / 0.7, $y$ / 1.5}{$-\\infty$, $2$, $+\\infty$}\n  \\tkzTabLine{,+,d,+,}\n  \\tkzTabVar{-/4, +D-/$+\\infty$/$-\\infty$,+/4}\n\\end{tikzpicture}`,
    visualType: 'table'
  },
  {
    id: 'p8',
    title: 'Đồ thị hàm số phân thức',
    category: 'Giải tích 12',
    text: 'Đường cong ở hình bên dưới là đồ thị của hàm số nào?',
    type: 'multiple_choice',
    choices: [
      { id: 'a', text: '$y = \\dfrac{x^2 + 2x + 2}{-x-1}$', isTrue: true, solution: 'Đồ thị có tiệm cận đứng $x=-1$, tiệm cận xiên $y = -x-1$ và tâm đối xứng $I(-1;0)$.' },
      { id: 'b', text: '$y = \\dfrac{x^2 + 2x + 2}{x+1}$', isTrue: false, solution: 'Tiệm cận xiên $y=x+1$ có hệ số góc dương, không khớp đồ thị.' },
      { id: 'c', text: '$y = \\dfrac{x^2-2x + 2}{x-1}$', isTrue: false, solution: 'Sai tiệm cận đứng.' },
      { id: 'd', text: '$y = \\dfrac{x^2 -2x + 2}{x+1}$', isTrue: false, solution: 'Tọa độ điểm cực trị không khớp.' },
    ],
    tikz: `\\begin{tikzpicture}[line cap=round,line join=round,font=\\footnotesize,>=stealth,scale=0.65]\n\t\\draw[->] (-5,0)--(3,0) node[above] {$x$};\n\t\\draw[->] (0,-4)--(0,4) node[right] {$y$};\n\t\\fill (0,0) circle (1pt) node [below right] {$O$};\n\t\\draw [samples=100, domain=-5:-1.27] plot (\\x, {((\\x)^2+2*(\\x)+2)/(-(\\x)-1)});\n\t\\draw [samples=100, domain=-0.73:3] plot (\\x, {((\\x)^2+2*(\\x)+2)/(-(\\x)-1)});\n\t\\draw (-5,4)--(3,-4) (-1,-4)--(-1,4);\n\t\\fill (-1,0) circle (1.5pt) node [below left] {$-1$};\n\\end{tikzpicture}`,
    visualType: 'geometry'
  },
  {
    id: 'p9',
    title: 'Đồ thị hàm số bậc 3 (Overleaf Standard)',
    category: 'Showcase',
    text: 'Đồ thị hàm số $y = -x^3 + 3x^2 - 4$ được trình bày theo chuẩn LaTeX chuyên nghiệp.',
    type: 'multiple_choice',
    choices: [
      { id: 'a', text: 'Hàm số có 2 cực trị', isTrue: true, solution: 'Dễ dàng quan sát được một cực tiểu tại $(1, -2)$ và một cực đại tại $(2, 0)$ hoặc tương tự.' },
      { id: 'b', text: 'Hàm số đồng biến trên toàn trục số', isTrue: false, solution: 'Sai, hệ số $a < 0$.' }
    ],
    tikz: `\\begin{tikzpicture}[>=Stealth, font=\\small]\n% 1. Vẽ hệ trục tọa độ\n\\draw[->, thick] (-2, 0) -- (4, 0) node[below] {$x$};\n\\draw[->, thick] (0, -5.5) -- (0, 1.5) node[right] {$y$};\n\n% 2. Nhãn gốc tọa độ\n\\node[below left] at (0, 0) {$O$};\n\n% 3. Vẽ đồ thị hàm số y = -x^3 + 3x^2 - 4\n\\draw[very thick, samples=100, domain=-1.2:3.4]\n  plot (\\x, {-(\\x)^3 + 3*(\\x)^2 - 4 });\n\n% 4. Các đường gióng (Dashed lines)\n\\draw[dashed] (1, 0) -- (1, -2) -- (0, -2);\n\\draw[dashed] (3, 0) -- (3, -4) -- (0, -4);\n\n% 5. Đánh dấu các trị số x\n\\draw[thick] (-1, -0.05) -- (-1, 0.05) node[below left] {$-1$};\n\\draw[thick] (1, -0.05) -- (1, 0.05) node[above] {$1$};\n\\draw[thick] (2, -0.05) -- (2, 0.05) node[above] {$2$};\n\\draw[thick] (3, -0.05) -- (3, 0.05) node[above] {$3$};\n\n% 6. Đánh dấu các trị số y\n\\draw[thick] (-0.05, -2) -- (0.05, -2) node[left] {$-2$};\n\\draw[thick] (-0.05, -4) -- (0.05, -4) node[below left] {$-4$};\n\\end{tikzpicture}`,
    visualType: 'geometry'
  }
];

export default function App() {
  const [problems, setProblems] = useState<Problem[]>(PROBLEMS_LIBRARY);
  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const currentProblem = problems[currentProblemIdx];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, 'true' | 'false' | null>>({
    a: null, b: null, c: null, d: null
  });
  const [showResults, setShowResults] = useState(false);
  const [isLoadingVisual, setIsLoadingVisual] = useState<Record<string, boolean>>({});
  const [compilationError, setCompilationError] = useState<Record<string, string | null>>({});
  const [showTikZEditor, setShowTikZEditor] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  
  // Khởi tạo Cache từ LocalStorage để tiết kiệm Quota
  const compilationCache = useRef<Record<string, string>>({});

  // Khởi tạo Cache từ LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tikz_svg_cache');
      if (saved) compilationCache.current = JSON.parse(saved);
    } catch {}
  }, []);

  const saveToCache = (id: string, svg: string) => {
    compilationCache.current[id] = svg;
    try {
      localStorage.setItem('tikz_svg_cache', JSON.stringify(compilationCache.current));
    } catch (e) {
      console.warn("Không thể lưu cache vào LocalStorage (có thể do quá dung lượng)");
    }
  };

  const handleBulkImport = async (text: string) => {
    if (!text.trim()) return;
    setIsImporting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const prompt = `
        Bạn là một trình phân tích mã LaTeX toán học chuyên nghiệp. 
        Nhiệm vụ: Chuyển đổi mã nguồn LaTeX dưới đây thành mảng JSON chứa các bài tập.
        
        QUY TẮC Cực kỳ quan trọng về Nội dung (text) và Đáp án (choices):
        1. GIỮ NGUYÊN 100% cấu trúc LaTeX cho mọi biểu thức toán học.
        2. TẤT CẢ các con số đơn lẻ, biến số, phân số, hằng số (ví dụ: $1$, $x$, $\\frac{1}{2}$, $A$) PHẢI được đặt trong cặp dấu $...$. KHÔNG ĐƯỢC bỏ sót.
        3. Nếu trong file gốc có dấu $...$ bao quanh số, tuyệt đối không được gỡ bỏ.
        4. Với TikZ: Trích xuất toàn bộ mã từ \\begin{tikzpicture} đến \\end{tikzpicture}.
        
        Cấu trúc JSON mỗi đối tượng:
        - title: Tiêu đề tóm tắt.
        - category: Thể loại (Lớp 10, 11, 12, Giải tích, Hình học...).
        - text: Nội dung câu hỏi (đảm bảo đầy đủ các ký hiệu $...$ cho toán học).
        - type: 'multiple_choice'.
        - choices: Mảng 4 đối tượng { id: 'a'|'b'|'c'|'d', text: 'nội dung chứa LaTeX', isTrue: boolean, solution: 'giải thích' }.
        - tikz: Mã TikZ (nếu có).
        - visualType: 'table' (bảng) hoặc 'geometry' (hình vẽ).
        
        Chỉ trả về JSON sạch, không có văn bản giải thích nào khác.
        
        Mã nguồn cần phân tích:
        ${text}
      `;
      const result = await ai.models.generateContent({
        model: MAIN_MODEL,
        contents: [{ parts: [{ text: prompt }] }]
      });
      const jsonText = result.text?.trim().replace(/```json|```/g, '') || '';
      const newProblemsRaw = JSON.parse(jsonText);
      
      const newProblems = newProblemsRaw.map((p: any, idx: number) => ({
        ...p,
        id: `import_${Date.now()}_${idx}`
      }));

      setProblems(prev => [...prev, ...newProblems]);
      setShowImportModal(false);
      setImportText('');
    } catch (err) {
      console.error("Lỗi Import:", err);
      alert("Không thể phân tích mã LaTeX. Vui lòng kiểm tra lại định dạng.");
    } finally {
      setIsImporting(false);
    }
  };

  const renderTikZ = async (problemId: string, tikz: string, forceRecompile = false) => {
    // Check cache first
    if (!forceRecompile && compilationCache.current[problemId]) {
      setProblems(prev => prev.map(p => 
        p.id === problemId ? { ...p, svgPreviewString: compilationCache.current[problemId] } : p
      ));
      return;
    }

    const cleanedTikZ = tikz.replace(/\\begin{center}/g, '').replace(/\\end{center}/g, '').trim();

    try {
      setIsLoadingVisual(prev => ({ ...prev, [problemId]: true }));
      setCompilationError(prev => ({ ...prev, [problemId]: null }));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `
        Bạn là một chuyên gia LaTeX và TikZ cao cấp. Hãy đóng vai trò là một trình biên dịch TikZ-to-SVG chính xác tuyệt đối.
        Nhiệm vụ: Chuyển đổi mã TikZ sau thành mã SVG chất lượng cao.
        
        YÊU CẦU KỸ THUẬT CỰC KỲ KHẮT KHE:
        1. Bảng biến thiên (tkz-tab): 
           - Phải vẽ các đường kẻ dọc và ngang thẳng hàng tuyệt đối.
           - Ký hiệu gián đoạn (||) phải là hai đường thẳng đứng song song sát nhau.
           - Các mũi tên (arrows) phải mượt mà, điểm đầu và điểm cuối khớp với cực trị.
        2. Chữ và Ký hiệu: 
           - Sử dụng phông chữ serif chuyên cho Toán học (ví dụ: Times New Roman, Computer Modern).
           - Căn chỉnh text chính giữa các ô, không được chồng lấn lên nhau.
           - Các ký hiệu vô cùng ($\\infty$), đạo hàm ($f'(x)$) phải hiển thị đẹp.
        3. Tọa độ: Tính toán tọa độ chính xác để không có nét vẽ nào bị lệch.
        
        ĐẦU RA: Chỉ trả về đoạn mã <svg>...</svg> hoàn chỉnh. Không giải thích.
        
        Mã TikZ cần biên dịch:
        ${cleanedTikZ}
      `;

      const result = await ai.models.generateContent({
        model: MAIN_MODEL,
        contents: [{ parts: [{ text: prompt }] }]
      });

      const svgCode = result.text?.trim().replace(/```svg|```xml|```/g, '') || '';
      if (svgCode.includes('<svg')) {
        saveToCache(problemId, svgCode);
        setProblems(prev => prev.map(p => 
          p.id === problemId ? { ...p, svgPreviewString: svgCode } : p
        ));
      } else {
        throw new Error("AI không tạo được SVG hợp lệ.");
      }
    } catch (err: any) {
      console.error("Lỗi Render:", err);
      let errorMsg = "Không thể hiển thị hình ảnh.";
      if (err.message?.includes('quota') || err.message?.includes('429')) {
        errorMsg = "Hạn mức AI (Quota) hiện đang tạm hết. Vui lòng thử lại sau 1-2 phút.";
      } else {
        errorMsg += " Lỗi: " + err.message;
      }
      setCompilationError(prev => ({ ...prev, [problemId]: errorMsg }));
    } finally {
      setIsLoadingVisual(prev => ({ ...prev, [problemId]: false }));
    }
  };

  useEffect(() => {
    setUserAnswers({ a: null, b: null, c: null, d: null });
    setShowResults(false);
    if (currentProblem && !currentProblem.svgPreviewString) {
      renderTikZ(currentProblem.id, currentProblem.tikz);
    }
  }, [currentProblemIdx]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);

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
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);
    return new Blob([header, pcmData], { type: 'audio/wav' });
  };

  const handleTTS = async (customText?: string) => {
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
      const choicesText = currentProblem.choices 
        ? currentProblem.choices.map(c => `Phương án ${c.id.toLowerCase()}: ${c.text}`).join('. ')
        : '';
      const instruction = "Bạn là giáo viên Toán. Hãy đọc nội dung sau một cách tự nhiên. Với các khoảng như (a, b), hãy đọc là 'khoảng từ a đến b', không đọc ký tự đóng mở ngoặc.";
      const prompt = `${instruction} Nội dung: ${customText || currentProblem.text + '. ' + (choicesText ? 'Các phương án trả lời là: ' + choicesText : '')}`;

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = (response.candidates?.[0]?.content?.parts?.[0] as any)?.inlineData?.data;
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

        const wavBlob = createWavBlob(bytes, 24000);
        setLastAudioBlob(wavBlob);

        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        const audioContext = audioContextRef.current;
        const floatData = new Float32Array(bytes.length / 2);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < floatData.length; i++) floatData[i] = view.getInt16(i * 2, true) / 32768;

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
    } catch (error: any) {
      console.error("TTS Error:", error);
      if (error.message?.includes('quota') || error.message?.includes('429')) {
        alert("Hạn mức đọc bằng trí tuệ nhân tạo (Quota) hiện đang tạm hết. Vui lòng thử lại sau 1-2 phút.");
      }
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleAnswer = (id: string, answer: 'true' | 'false') => {
    setUserAnswers(prev => ({ ...prev, [id]: answer }));
  };

  return (
    <div className="flex h-screen bg-paper font-sans text-ink selection:bg-accent/20 overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: showSidebar ? 200 : 0, opacity: showSidebar ? 1 : 0 }}
        className="border-r border-border bg-white flex flex-col h-full relative z-30"
      >
         <header className="p-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-[8px] uppercase tracking-[0.2em] font-bold text-muted mb-0.5 whitespace-nowrap">Thư viện</h2>
              <div className="h-0.5 w-6 bg-accent"></div>
            </div>
            <button 
              onClick={() => setShowSidebar(false)}
              className="p-1 hover:bg-paper rounded-full text-muted transition-colors"
            >
              <PanelLeftClose size={14} />
            </button>
         </header>

         <div className="p-2 border-b border-border grid grid-cols-2 gap-2">
            <button 
              onClick={() => setShowImportModal(true)}
              title="Import .tex / Paste Code"
              className="flex items-center justify-center py-2 bg-paper border border-dashed border-border rounded-sm hover:border-accent hover:text-accent transition-all"
            >
              <FileUp size={16} />
            </button>

            <button 
                onClick={() => handleTTS()}
                disabled={isSynthesizing}
                title="Đọc đề bằng AI"
                className={`flex items-center justify-center py-2 rounded-sm border transition-all duration-300 ${isSynthesizing ? 'border-accent bg-accent text-white animate-pulse' : isPlaying ? 'border-accent bg-accent text-white' : 'border-border bg-white text-muted hover:border-accent hover:text-accent'}`}
            >
                {isSynthesizing ? <Loader2 className="animate-spin" size={16} /> : isPlaying ? <Pause size={16} /> : <Volume2 size={16} />}
            </button>
         </div>

         <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {problems.map((problem, idx) => (
              <div key={idx} className="group relative">
                <button
                  onClick={() => setCurrentProblemIdx(idx)}
                  className={`w-full text-left p-2.5 rounded-sm transition-all ${currentProblemIdx === idx ? 'bg-ink text-white shadow-md' : 'hover:bg-paper-alt border border-transparent hover:border-border'}`}
                >
                  <p className={`text-[8px] uppercase tracking-widest mb-0.5 ${currentProblemIdx === idx ? 'text-white/60' : 'text-muted'}`}>{problem.category}</p>
                  <p className="font-serif italic text-[13px] leading-tight group-hover:pr-6">{problem.title}</p>
                </button>
                {problems.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setProblems(prev => prev.filter((_, i) => i !== idx));
                      if (currentProblemIdx >= idx && currentProblemIdx > 0) setCurrentProblemIdx(prev => prev - 1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
         </nav>
      </motion.aside>

      {/* Floating Toggle for Sidebar */}
      {!showSidebar && (
        <button 
          onClick={() => setShowSidebar(true)}
          className="fixed left-4 top-4 z-40 p-3 bg-white border border-border rounded-full shadow-lg hover:bg-accent hover:text-white transition-all"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      <main className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* Left: Content */}
        <div className="p-2 md:p-4 border-r border-border bg-white">
          <section className="space-y-3 max-w-4xl">
             <div className="flex items-center gap-4">
                <span className="px-2 py-0.5 bg-ink text-white text-[9px] font-mono rounded-full uppercase tracking-tighter">Bài {currentProblemIdx + 1}</span>
                <div className="h-px flex-1 bg-border/50"></div>
             </div>

             <h1 className="font-serif text-lg leading-[1.3] text-ink">
               <FormattedMath text={currentProblem.text} />
             </h1>

              {/* Preview & Editor Section */}
              <div className="pt-2">
                <div className={`grid gap-px bg-border border border-border rounded-sm shadow-xl overflow-hidden transition-all duration-500 ${showTikZEditor ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Code Panel (Conditional) */}
                  {showTikZEditor && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[#1e1e1e] p-6 space-y-4"
                    >
                      <div className="flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest font-mono">
                        <div className="flex items-center gap-2">
                          <Code size={12} />
                          <span>TikZ Source (Editable)</span>
                        </div>
                      </div>
                      <textarea 
                        value={currentProblem.tikz}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setProblems(prev => prev.map(p => p.id === currentProblem.id ? { ...p, tikz: newCode } : p));
                        }}
                        className="w-full h-[300px] bg-transparent text-[#d4d4d4] font-mono text-[13px] leading-relaxed resize-none focus:outline-none border-none selection:bg-accent/30"
                        spellCheck={false}
                      />
                      <div className="pt-4 border-t border-white/10 flex justify-end">
                        <button 
                          onClick={() => renderTikZ(currentProblem.id, currentProblem.tikz, true)}
                          disabled={isLoadingVisual[currentProblem.id]}
                          className="px-4 py-2 bg-accent text-white rounded-xs text-[10px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all flex items-center gap-2"
                        >
                          {isLoadingVisual[currentProblem.id] ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} fill="currentColor" />}
                          Cập nhật hình vẽ
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Preview Panel */}
                  <div className="bg-white p-1 relative flex items-center justify-center max-h-[500px] transition-all duration-500 border-t border-border/50 lg:border-t-0 lg:border-l lg:border-border/50 group">
                    {/* Toggle Editor Icon Overlay */}
                    <button 
                      onClick={() => setShowTikZEditor(!showTikZEditor)}
                      title={showTikZEditor ? "Ẩn mã TikZ" : "Xem mã TikZ"}
                      className="absolute top-2 right-2 z-20 p-1.5 bg-white/80 backdrop-blur-sm border border-border rounded-full text-muted hover:text-accent hover:border-accent transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                    >
                      <Code size={14} />
                    </button>

                    {isLoadingVisual[currentProblem.id] && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="animate-spin text-accent" size={32} />
                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-accent">AI đang vẽ...</p>
                      </div>
                    )}
                    
                    <div className="w-full h-auto flex flex-col items-center justify-center overflow-hidden">
                      {compilationError[currentProblem.id] ? (
                        <div className="flex flex-col items-center gap-4 text-false text-center p-2 max-w-full">
                          <XCircle size={32} />
                          <div className="max-h-48 overflow-auto bg-false/5 border border-false/20 p-2 rounded w-full">
                            <p className="font-mono text-[10px] text-left whitespace-pre-wrap">{compilationError[currentProblem.id]}</p>
                          </div>
                          <button 
                            onClick={() => renderTikZ(currentProblem.id, currentProblem.tikz, true)}
                            className="text-[10px] uppercase tracking-widest font-bold underline"
                          >Thử lại</button>
                        </div>
                      ) : currentProblem.svgPreviewString ? (
                        <div 
                          className="w-full max-w-full text-ink flex justify-center transition-all duration-500 cursor-zoom-in py-1" 
                          dangerouslySetInnerHTML={{ 
                            __html: currentProblem.svgPreviewString
                              .replace(/<svg/, '<svg style="max-height: 400px; width: 100%; height: auto; object-fit: contain; transform: scale(0.75); transform-origin: center;" ') 
                          }} 
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-10 py-4">
                          <Maximize2 size={48} strokeWidth={1} />
                          <p className="font-serif italic text-[12px] text-center">Đang chuẩn bị hình vẽ...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

             {/* Choices Area */}
             <div className="bg-paper/30 border border-border/50 rounded-sm p-1.5 shadow-sm">
                <div className="grid grid-cols-2 gap-1.5">
                  {currentProblem.choices?.map((choice) => (
                    <button
                      key={choice.id}
                      onClick={() => handleAnswer(choice.id, choice.isTrue ? 'true' : 'false')}
                      className={`p-1.5 text-left border rounded-sm transition-all relative group/choice ${
                        showResults 
                          ? choice.isTrue ? 'bg-green-50 border-green-200' : userAnswers[choice.id] === 'false' ? 'bg-red-50 border-red-200' : 'bg-white border-border opacity-50'
                          : 'bg-white border-border hover:border-accent hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted tracking-widest shrink-0">{choice.id.toLowerCase()})</span>
                        <div className="text-[13px] leading-tight text-ink">
                           <FormattedMath text={choice.text} />
                        </div>
                      </div>
                      {showResults && choice.isTrue && <CheckCircle2 className="absolute top-1 right-1 text-green-500" size={12} />}
                    </button>
                  ))}
                </div>
             </div>
          </section>
        </div>

        {/* Right: Actions & Solution */}
        <aside className="bg-paper p-2 md:p-3 flex flex-col gap-4">
          <section className="space-y-2">
            <div className="flex flex-col gap-2">
               <button 
                  onClick={() => setShowResults(!showResults)}
                  className="w-full flex items-center justify-between p-3 bg-ink text-white rounded-sm hover:bg-ink/90 transition-all font-bold uppercase tracking-widest text-[9px]"
               >
                  <span>{showResults ? 'Ẩn lời giải' : 'Lời giải'}</span>
                  <HelpCircle size={14} />
               </button>
            </div>
          </section>

          {showResults && (
            <motion.section 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2 flex-1 flex flex-col"
            >
               <h3 className="text-[8px] uppercase tracking-[0.3em] font-bold text-muted">Lời giải</h3>
               <div className="flex-1 bg-white border border-border p-2 rounded-sm space-y-2 overflow-y-auto shadow-xs">
                 <div className="text-lg font-serif italic text-ink/80 leading-snug">
                   {currentProblem.choices?.find(c => c.isTrue)?.solution && (
                     <FormattedMath text={currentProblem.choices.find(c => c.isTrue)!.solution} />
                   )}
                 </div>
                 <div className="h-px bg-border/50"></div>
                 <button 
                    onClick={() => handleTTS(currentProblem.choices?.find(c => c.isTrue)?.solution)}
                    className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-2 hover:opacity-80"
                 >
                   <Volume2 size={12} />
                   Nghe phân tích chi tiết
                 </button>
               </div>
            </motion.section>
          )}
        </aside>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-sm shadow-2xl flex flex-col max-h-[80vh]"
          >
            <header className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileUp className="text-accent" />
                <h2 className="font-serif text-xl italic">Nhập dữ liệu bài tập (.tex)</h2>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-muted hover:text-ink"><XCircle size={24} /></button>
            </header>

            <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted leading-relaxed max-w-[70%]">
                  Dán mã nguồn LaTeX hoặc tải lên file .tex. AI sẽ tự động phân tách và thêm vào thư viện của bạn.
                </p>
                <input 
                  type="file" 
                  accept=".tex,.txt"
                  id="tex-file-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setImportText(ev.target?.result as string);
                      reader.readAsText(file);
                    }
                  }}
                />
                <label 
                  htmlFor="tex-file-upload"
                  className="px-4 py-2 bg-paper border border-border rounded-sm text-[10px] font-bold uppercase tracking-widest hover:border-accent hover:text-accent cursor-pointer transition-all flex items-center gap-2"
                >
                  <FileUp size={14} />
                  Tải file .tex
                </label>
              </div>
              
              <div className="relative flex-1">
                <textarea 
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Dán mã LaTeX tại đây... (Ví dụ: \begin{question} ... \end{question})"
                  className="w-full h-full bg-paper p-4 font-mono text-sm border border-border rounded-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none resize-none"
                />
                {isImporting && (
                  <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={40} className="animate-spin text-accent" />
                    <p className="text-xs font-bold uppercase tracking-widest text-accent animate-pulse">AI đang phân tích dữ liệu...</p>
                  </div>
                )}
              </div>
            </div>

            <footer className="p-6 border-t border-border flex justify-end gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-ink transition-colors"
              >Hủy bỏ</button>
              <button 
                onClick={() => handleBulkImport(importText)}
                disabled={isImporting || !importText.trim()}
                className="px-8 py-2 bg-accent text-white rounded-xs text-[10px] font-bold uppercase tracking-widest hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                <ClipboardPaste size={14} />
                Bắt đầu nhập
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </div>
  );
}
