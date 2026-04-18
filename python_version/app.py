import streamlit as st
import os
import json
import base64
import tempfile
import subprocess
from google import genai
from google.genai import types

# Cấu hình trang
st.set_page_config(page_title="Công cụ dạy-học Toán", layout="wide", page_icon="📐")

# Khởi tạo Gemini Client
API_KEY = os.environ.get("GEMINI_API_KEY", "")
client = genai.Client(api_key=API_KEY) if API_KEY else None

# Phân bổ model theo tác vụ cụ thể dựa trên danh sách khả dụng
TTS_MODEL = "gemini-3.1-flash-tts-preview"   # Chuyên trách Âm thanh
MAIN_MODEL = "gemini-2.5-flash"              # Chuyên trách JSON & Import nhanh
PRO_MODEL = "gemini-2.5-pro"                 # Chuyên trách suy luận toán học sâu / TikZ

# Lưu trữ dữ liệu trong Session State (tương đương với state trong React)
if 'problems' not in st.session_state:
    st.session_state.problems = []
if 'current_problem_idx' not in st.session_state:
    st.session_state.current_problem_idx = 0
if 'svg_cache' not in st.session_state:
    st.session_state.svg_cache = {}

def render_tikz_local(tikz_code: str) -> str:
    """
    Render mã TikZ thành SVG sử dụng pdflatex và pdf2svg có sẵn trên hệ thống Linux (Arch).
    Giúp tạo ra hình vẽ chuẩn đồ họa Vector 100% không tốn API.
    """
    # Gói mã TikZ vào template TeX tối giản dạng standalone
    tex_template = f"""\\documentclass[tikz,border=2pt]{{standalone}}
\\usepackage{{amsmath,amssymb}}
\\usepackage{{tkz-tab}} % Rất quan trọng cho bảng biến thiên
\\begin{{document}}
{tikz_code}
\\end{{document}}
"""
    try:
        # Tạo thư mục tạm để chứa các tệp biên dịch
        with tempfile.TemporaryDirectory() as tmpdirname:
            tex_file = os.path.join(tmpdirname, "diagram.tex")
            pdf_file = os.path.join(tmpdirname, "diagram.pdf")
            svg_file = os.path.join(tmpdirname, "diagram.svg")
            
            # 1. Lưu mã TeX
            with open(tex_file, "w", encoding="utf-8") as f:
                f.write(tex_template)
            
            # 2. Biên dịch TeX sang PDF bằng pdflatex
            # Chạy 1 lần thường là đủ cho TikZ đơn giản
            subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmpdirname, tex_file],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True
            )
            
            # 3. Chuyển PDF sang SVG
            subprocess.run(
                ["pdf2svg", pdf_file, svg_file],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True
            )
            
            # 4. Đọc kết quả SVG
            with open(svg_file, "r", encoding="utf-8") as f:
                svg_content = f.read()
                
            return svg_content
    except Exception as e:
        return f"<div style='color:red'>Lỗi Render Local: {str(e)}.<br>Vui lòng đảm bảo môi trường đã load `texlive.sh` (chứa đường dẫn pdflatex) và bạn đã cài `pdf2svg` trên Arch.</div>"

def handle_tts(text_to_read):
    if not client:
        st.error("Thiếu GEMINI_API_KEY.")
        return None
        
    instruction = "Bạn là giáo viên Toán. Hãy đọc nội dung sau một cách tự nhiên. Với các khoảng như (a, b), hãy đọc là 'khoảng từ a đến b', không đọc ký tự đóng mở ngoặc."
    prompt = f"{instruction} Nội dung: {text_to_read}"
    
    try:
        response = client.models.generate_content(
            model=TTS_MODEL,
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Kore"
                        )
                    )
                )
            )
        )
        
        # Audio bytes từ API
        if response.candidates and response.candidates[0].content.parts:
            audio_bytes = response.candidates[0].content.parts[0].inline_data.data
            return audio_bytes
    except Exception as e:
        st.error(f"Lỗi TTS: Quota giới hạn hoặc hệ thống lỗi. ({e})")
        return None

def main():
    st.title("📐 AI Math Studio")

    # Layout chính (Sidebar trái và Cột nội dung phải)
    sidebar = st.sidebar
    
    with sidebar:
        st.header("Thư viện")
        st.markdown("---")
        
        # Import LaTeX
        with st.expander("📥 Import .tex / Paste Code", expanded=False):
            tex_input = st.text_area("Dán mã LaTeX vào đây:", height=200)
            if st.button("Phân tích AI", use_container_width=True):
                if tex_input and client:
                    with st.spinner("AI đang phân tích mã chuẩn hóa..."):
                        prompt = f"""Bạn là một trình phân tích mã LaTeX toán học...
                        Trả về mảng JSON. 
                        Nội dung: {tex_input}"""
                        try:
                            # Mô phỏng quá trình xử lý:
                            result = client.models.generate_content(
                                model=MAIN_MODEL, 
                                contents=[prompt]
                            )
                            cleaned = result.text.strip().replace("```json", "").replace("```", "")
                            new_probs = json.loads(cleaned)
                            st.session_state.problems.extend(new_probs)
                            st.success("Import thành công!")
                        except Exception as e:
                            st.error("Lỗi phân tích JSON.")
                            
        # Nút đọc Voice
        if len(st.session_state.problems) > 0:
            current_prob = st.session_state.problems[st.session_state.current_problem_idx]
            
            st.markdown("### Công cụ Giọng nói")
            if st.button("🔊 Đọc đề bằng AI", use_container_width=True):
                with st.spinner("Đang chuẩn bị âm thanh..."):
                    audio_data = handle_tts(current_prob.get('text', 'Không có nội dung'))
                    if audio_data:
                        st.audio(audio_data, format="audio/wav")

    # Vùng hiển thị chính
    if len(st.session_state.problems) == 0:
        st.info("Chưa có bài tập nào. Vui lòng Import mã LaTeX từ thanh công cụ bên trái.")
    else:
        current_prob = st.session_state.problems[st.session_state.current_problem_idx]
        
        col_main, col_nav = st.columns([3, 1])
        
        with col_main:
            st.subheader(f"Bài tập: {current_prob.get('title', 'Câu hỏi')}")
            st.latex(current_prob.get('text', ''))  # Streamlit hỗ trợ st.latex()
            
            # Khung TikZ preview
            if 'tikz' in current_prob:
                with st.expander("🔍 TikZ Viewer (SVG/Mã nguồn)", expanded=True):
                    ch1, ch2 = st.tabs(["🖼️ SVG Render", "💻 Mã TikZ"])
                    with ch1:
                        tikz_code = current_prob['tikz']
                        
                        # Xử lý Render SVG (Ưu tiên dùng Cache để không biên dịch lại)
                        if current_prob.get('id') not in st.session_state.svg_cache:
                            with st.spinner("Đang biên dịch TikZ cục bộ trên máy Arch của bạn..."):
                                svg_out = render_tikz_local(tikz_code)
                                if current_prob.get('id'):
                                     st.session_state.svg_cache[current_prob['id']] = svg_out
                        else:
                            svg_out = st.session_state.svg_cache[current_prob['id']]
                            
                        # Hiển thị SVG bằng HTML
                        st.components.v1.html(svg_out, height=400, scrolling=True)
                        
                    with ch2:
                        st.code(tikz_code, language='latex')
                        
            # Phương án
            choices = current_prob.get('choices', [])
            if choices:
                st.markdown("---")
                cols = st.columns(2)
                for i, choice in enumerate(choices):
                    col_idx = i % 2
                    with cols[col_idx]:
                        # Render phương án. LaTeX bao trong $$
                        st.write(f"**{choice.get('id', '').lower()})** {choice.get('text', '')}")

        with col_nav:
            st.markdown("### Điều hướng")
            if st.button("⏪ Bài trước", disabled=st.session_state.current_problem_idx == 0):
                st.session_state.current_problem_idx -= 1
                st.rerun()
                
            if st.button("Bài sau ⏩", disabled=st.session_state.current_problem_idx >= len(st.session_state.problems) - 1):
                st.session_state.current_problem_idx += 1
                st.rerun()

if __name__ == "__main__":
    main()
