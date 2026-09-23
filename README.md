# 🎓 StudyHub - Hệ Thống Quản Lý Học Tập Cá Nhân Toàn Diện (Personal Academic Management System)

> Ứng dụng web quản lý học tập cá nhân toàn diện dành cho sinh viên, hoạt động **100% Client-side** với công nghệ **IndexedDB** bền vững, hỗ trợ chuẩn **PWA cài đặt Offline**, giao diện tiếng Việt hiện đại và tối ưu hóa phản hồi chuẩn xác trên cả **Desktop (1440px)** lẫn **Mobile (375px)**.
>
> 🌐 **Website Online:** [https://hnam20076.github.io/StudyHub/](https://hnam20076.github.io/StudyHub/)  
> 📦 **GitHub Repository:** [https://github.com/Hnam20076/StudyHub](https://github.com/Hnam20076/StudyHub)

---

## ✨ 11 Phân Hệ Học Tập Hoàn Chỉnh (All 11 Modules)

### 📊 1. Command Center Dashboard (Tổng quan học tập)
- **Widget Buổi học tiếp theo (Live Ticker):** Tự động phát hiện tiết học đang diễn ra (với hiệu ứng sóng radar và đếm ngược phút còn lại), hoặc tiết học tiếp theo trong ngày / tuần.
- **Widget Kỳ thi gần nhất:** Thẻ đếm ngược ngày thi lớn, tự động cảnh báo đỏ/cam khi kỳ thi còn dưới 7 ngày.
- **Widget Deadline (Nhiệm vụ):** 4 Tab phân loại (*Hôm nay, Ngày mai, 7 ngày tới, Quá hạn*), tích hợp checkbox tick hoàn thành ngay lập tức kèm thanh thông báo Toast hỗ trợ **Hoàn tác (Undo)**.
- **Widget Tiến độ học tập theo môn:** Thanh tiến độ mini trực quan theo môn học, nhấp vào mở ngay modal chi tiết môn.
- **Widget Thời gian tập trung (Pomodoro):** Tổng hợp thời gian tập trung học hôm nay và tuần này, nút tắt bắt đầu phiên bấm giờ ngay.
- **Widget Điểm số & GPA:** Tính GPA tích lũy thang 4.0 và tổng tín chỉ đã hoàn thành.

### 📚 2. Quản Lý Môn Học (Subjects - Module trung tâm)
- Quản lý danh mục môn học: Mã môn học, Số tín chỉ, Giảng viên phụ trách, Mục tiêu điểm số (A/B+/...), Màu nhận diện.
- **Thẻ môn học thông minh:** Tự động tính toán tổng số buổi học, bài tập, ghi chú, kỳ thi và tỷ lệ hoàn thành môn.
- **Modal chi tiết môn học (5 Tab):**
  - *Tổng quan:* Thông tin giảng viên, mục tiêu, mô tả học phần.
  - *Nhiệm vụ:* Danh sách deadline liên quan, tạo task nhanh theo môn.
  - *Tài liệu & Đính kèm:* Quản lý file PDF, Word, PowerPoint, Slide bài giảng (kéo thả hoặc chọn file, lưu trữ trực tiếp trong IndexedDB).
  - *Ghi chú & Sơ đồ:* Liên kết trực tiếp toàn bộ bài ghi và mindmap của môn.
  - *Kỳ thi & Điểm số:* Lịch thi và bảng điểm chi tiết thành phần.

### 📅 3. Thời Khóa Biểu 16 Tuần (Schedule)
- **Chuẩn hóa lịch học đại học:** Tích hợp sẵn 76 buổi học (Học kỳ 1 • 2026-2027) của 5 môn học.
- **Thanh chuyển tuần 16 Tuần:** Chuyển đổi nhanh giữa Tuần 1 đến Tuần 16 hoặc xem toàn khóa.
- **Nhận diện học trực tuyến:** Huy hiệu nhấp nháy cho tiết học **E-Learning** và nhãn tím cho **MS Teams**.
- **Chế độ xem linh hoạt:** Lưới 7 ngày (Desktop), thanh chọn ngày thông minh (Mobile) và dòng thời gian ngày.
- **Phím tắt nhanh:** Phím mũi tên `←` / `→` để lướt qua các tuần học.

### ✅ 4. Nhiệm Vụ & Deadline (Tasks)
- Quản lý bài tập lớn, đồ án, tiểu luận, thuyết trình.
- Cấp độ ưu tiên: Khẩn cấp (đỏ), Cao (cam), Trung bình (xanh dương), Thấp (xám).
- Bộ lọc thông minh: *Tất cả, Hôm nay, 7 ngày tới, Quá hạn, Đã hoàn thành, Lọc theo môn học*.
- Đính kèm tài liệu nộp bài / đề bài ngay trong nhiệm vụ.

### 📝 5. Ghi Chú Bài Học (Notes)
- Trình soạn thảo Markdown trực quan với thanh công cụ nhanh (H2, H3, Bold, Code, Checklist).
- **To-do checklist tương tác:** Checkbox `- [ ]` tick chọn trực tiếp trên thẻ, tự động lưu ngay vào IndexedDB.
- **Bộ lọc 3 tầng:** Lọc theo Môn học, Chủ đề và Thẻ `#tag`.
- Ghim ghi chú quan trọng lên đầu.

### 🧠 6. Sơ Đồ Tư Duy (Mind Map Studio)
- Canvas vô cực kéo thả, zoom/pan từ 40% đến 200%.
- Kết nối nhánh bằng đường cong **Cubic Bezier** mượt mà.
- Phím tắt thông minh: `Tab` (thêm nhánh con), `Enter` (thêm nhánh ngang hàng), `Delete` (xóa nhánh).
- Xuất ảnh PNG độ phân giải cao Retina.

### 🖼️ 7. Chú Thích Ảnh Bài Giảng (Image Notes)
- Tải ảnh từ máy, kéo thả hoặc dán trực tiếp từ Clipboard (`Ctrl + V`).
- Cắm mốc ghim đánh số (1, 2, 3...) trực tiếp lên vùng ảnh slide/bảng viết.
- Giao diện 2 cột đồng bộ 2 chiều (bấm vào ghim tự highlight thẻ chú thích và ngược lại).

### 🎖️ 8. Quản Lý Kỳ Thi (Exams)
- Quản lý lịch thi: Quiz, Thi giữa kỳ, Thi cuối kỳ, Thực hành, Thuyết trình.
- **Live Countdown Ticker:** Bộ đếm ngược thời gian thực đến từng giây (Ngày, Giờ, Phút, Giây) cho kỳ thi kế tiếp.
- Lưu trữ thông tin phòng thi, hình thức thi, tỷ trọng điểm và tài liệu ôn tập.

### 📈 9. Điểm Số & GPA Chuẩn Đại Học (Grades)
- Quản lý cấu trúc điểm thành phần: Chuyên cần, Bài tập quá trình, Kiểm tra giữa kỳ, Thực hành, Đồ án, Thi kết thúc học phần.
- **Xác thực trọng số nghiêm ngặt:** Bắt buộc tổng tỷ trọng các thành phần phải đạt chuẩn **100%**.
- Tự động quy đổi chuẩn xác 3 thang điểm đại học:
  - Thang điểm 10
  - Thang điểm 4.0
  - Điểm chữ (A, B+, B, C+, C, D+, D, F)
- Tính điểm trung bình tích lũy học kỳ (Semester GPA) có trọng số theo số tín chỉ.

### 🚀 10. Tiến Độ Học Tập Toàn Diện (Academic Progress)
- **Đo lường khách quan từ 5 luồng dữ liệu thực:**
  1. *Lịch học:* Số tuần đã hoàn thành (X / 16 tuần)
  2. *Nhiệm vụ:* Tỷ lệ hoàn thành bài tập (X / Y bài đã nộp)
  3. *Ghi chú & Tài liệu:* Số lượng tài liệu đã tích lũy
  4. *Kỳ thi:* Số bài thi đã trải qua
  5. *Thời gian học:* Tổng số giờ phút tập trung tích lũy
- Biểu đồ tổng thể học kỳ và thanh tiến độ chi tiết từng môn.

### ⏱️ 11. Tập Trung Pomodoro (Focus Timer)
- Chế độ bấm giờ chuẩn khoa học: **25/5** (25p học / 5p nghỉ), **50/10** (50p học / 10p nghỉ) và **Tùy chỉnh phút**.
- Chọn môn học đang tập trung, chuông âm thanh báo hiệu khi hoàn thành.
- Tự động ghi nhận lịch sử vào `studySessions` và cập nhật thống kê thời gian học.

---

## 🔍 Tính Năng Nền Tảng (Cross-Cutting Features)

- **Omnisearch Toàn Cục (`Ctrl + K` / `Cmd + K`):** Hộp lệnh Command Palette tìm kiếm xuyên suốt **7 đối tượng**: Môn học, Thời khóa biểu, Nhiệm vụ, Kỳ thi, Ghi chú, Sơ đồ tư duy, Tài liệu đính kèm.
- **Thùng Rác & Phục Hồi 30 Ngày (Soft Delete):** Tất cả các thao tác xóa đều đưa vào Thùng rác an toàn trong 30 ngày, có thể khôi phục lại bất kỳ lúc nào hoặc dọn sạch vĩnh viễn.
- **Nhắc Nhở Lịch Học & Chuông Báo:** Tự động phát âm thanh thông báo trước 10-15 phút trước mỗi tiết học trong ngày.
- **Nhắc Nhở Sao Lưu Định Kỳ 7 Ngày:** Tự động nhắc nhở tải file sao lưu JSON an toàn sau mỗi 7 ngày.
- **PWA Hoàn Chỉnh (Add to Home Screen):** Tích hợp Web App Manifest và Service Worker Cache v2, cho phép cài đặt làm ứng dụng độc lập trên máy tính/điện thoại và hoạt động 100% Offline.
- **Giao Diện Sáng / Tối (Dark & Light Theme):** Chuyển đổi linh hoạt với phím tắt nhanh và tự động lưu tùy chọn.

---

## 🛠️ Ngăn Xếp Công Nghệ (Tech Stack)

- **Ngôn ngữ:** Pure HTML5, Modern CSS3, Vanilla ES6+ JavaScript Modules (Không dùng framework cồng kềnh).
- **Giao diện:** Tailwind CSS (Modern Glassmorphism & Micro-animations).
- **Biểu tượng & Font chữ:** Lucide Icons, Google Font *Be Vietnam Pro*.
- **Lưu trữ dữ liệu:** Trình duyệt **IndexedDB** (`StudyHubDB` version 2) với 11 bảng lưu trữ chuyên biệt:
  `schedules`, `subjects`, `tasks`, `exams`, `grades`, `studySessions`, `notes`, `mindmaps`, `imageNotes`, `attachments`, `settings`.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng

### 1. Sử dụng trực tiếp trên Web
Truy cập ngay:  
👉 **[https://hnam20076.github.io/StudyHub/](https://hnam20076.github.io/StudyHub/)**

### 2. Chạy máy chủ cục bộ (Local Server)
```bash
# Clone repository
git clone https://github.com/Hnam20076/StudyHub.git
cd StudyHub

# Chạy với Python 3
python -m http.server 3000

# Hoặc chạy với Node.js
npx serve .
```
Truy cập trình duyệt tại địa chỉ: `http://localhost:3000`

---

## 📄 Bản Quyền & Giấy Phép
Dự án được xây dựng và phát triển phục vụ học tập và nghiên cứu cá nhân.
