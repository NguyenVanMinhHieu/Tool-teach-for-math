# Hướng dẫn chạy Ứng dụng "Công cụ dạy-học Toán" phiên bản Python

Dự án này sử dụng Python và Streamlit, được viết để hoạt động mượt mà trên môi trường Linux (đặc biệt là Arch Linux).

## Yêu cầu hệ thống
- Python 3.10 trở lên
- Một tài khoản GitHub (để đẩy code lên repo)

## Hướng dẫn cài đặt và chạy trên máy tính cá nhân (Arch Linux)

1. **Cấu hình biến môi trường TeX Live**:
   Bạn đang dùng bộ cài TeX Live qua tệp ISO (Vanilla TeX Live) và đã cấu hình biến môi trường. Hãy đảm bảo bạn đã source tệp `texlive.sh` (ví dụ `source /etc/profile.d/texlive.sh`) vào shell hiện tại để terminal nhận diện được lệnh `pdflatex` trước khi tiến hành bước tiếp theo.
   
   Bên cạnh đó, vì ứng dụng dùng `pdf2svg` để chuyển đổi ảnh, nếu chưa có, hãy cài nó bằng pacman:
   ```bash
   sudo pacman -S pdf2svg
   ```

2. **Mở Terminal** và tạo môi trường ảo (Virtual Environment) để không làm bẩn hệ thống Arch của bạn:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. **Cài đặt thư viện**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Cấu hình API Key**:
   Tạo một tệp có tên `.env` ở cùng thư mục và thêm API Key Gemini của bạn vào:
   ```env
   GEMINI_API_KEY="thay_api_key_cua_ban_vao_day"
   ```

4. **Khởi chạy ứng dụng**:
   ```bash
   streamlit run app.py
   ```
   Trình duyệt của bạn sẽ tự động mở lên tại địa chỉ `http://localhost:8501`.

## Đưa lên GitHub
Bạn có thể đẩy toàn bộ thư mục `python_version` này lên kho chứa GitHub bằng các lệnh Git cơ bản:
```bash
git init
git add .
git commit -m "Khởi tạo công cụ Toán học bằng Python/Streamlit"
git branch -M main
git remote add origin git@github.com:TEN_CUA_BAN/py-math-tutor.git
git push -u origin main
```
