# Requirements Document: Local OCR Token Optimization

## Introduction

Tính năng **Local OCR Token Optimization** giảm chi phí token và cho phép hoạt
động offline cho AI Vision Capture bằng cách thêm một bước **OCR cục bộ
(Tesseract)** chạy TRƯỚC khi gọi Vision LLM (Gemini).

Phần lớn mục tiêu automation thực tế là nhãn văn bản ("Submit", "Login",
"Đăng nhập"...). Với các mục tiêu này, một lượt OCR cục bộ có thể định vị phần
tử với **0 token và không cần mạng**. LLM (tốn token) chỉ được gọi khi OCR cục
bộ không tìm thấy với độ tin cậy đủ cao.

Tính năng này bổ sung cho cơ chế Static/Dynamic Mode hiện có của
[ai-vision-capture](../ai-vision-capture/requirements.md): nó tối ưu chính
nhánh Dynamic (gọi AI khi playback) và bất kỳ lệnh `analyze()` nào có mục tiêu
là văn bản.

## Glossary

- **Local_OCR**: Lượt nhận dạng văn bản chạy cục bộ bằng Tesseract (qua
  `pytesseract`), không gọi mạng, không tốn token.
- **OCR_Engine**: Binary `tesseract` + binding `pytesseract`. Cả hai là tùy
  chọn (optional).
- **Text_Target**: Chuỗi văn bản cụ thể trích từ prompt (ví dụ phần trong dấu
  ngoặc kép) mà người dùng muốn định vị.
- **Match_Score**: Điểm khớp văn bản [0..1] giữa Text_Target và một text box do
  OCR phát hiện (exact / whole-word / substring).
- **Combined_Confidence**: `Match_Score × OCR_confidence`, ngưỡng quyết định
  chấp nhận hit cục bộ hay fallback LLM.
- **Fallback**: Hành vi chuyển sang gọi Vision LLM khi OCR cục bộ không đủ tin cậy.
- **Graceful_Degradation**: Khi OCR_Engine không khả dụng, hệ thống tự động dùng
  LLM mà không lỗi.
- **Telemetry**: Bộ đếm `local_ocr_hits` / `llm_calls` để định lượng token tiết kiệm.

## Requirements

### Requirement 1 — Ưu tiên OCR cục bộ trước LLM

**User Story:** As an automation author, I want text targets located locally
first, so that I do not spend LLM tokens on simple labels.

#### Acceptance Criteria

1. WHEN `analyze()` được gọi AND prompt chứa một Text_Target AND OCR_Engine khả
   dụng THEN hệ thống PHẢI thử Local_OCR trước khi gọi LLM.
2. IF Local_OCR trả về một hit với Combined_Confidence ≥ ngưỡng THEN hệ thống
   PHẢI trả kết quả đó VÀ KHÔNG được gọi LLM (0 token).
3. IF Local_OCR không tìm thấy hoặc Combined_Confidence < ngưỡng THEN hệ thống
   PHẢI Fallback sang LLM.
4. WHEN request có `reference_images` THEN hệ thống PHẢI bỏ qua Local_OCR (so
   khớp hình ảnh thuộc về LLM, không phải văn bản).

### Requirement 2 — Trích xuất Text_Target từ prompt

**User Story:** As a user, I want quoted text in my prompt treated as the target,
so that "Find the \"Submit\" button" locates `Submit`.

#### Acceptance Criteria

1. WHEN prompt chứa một cụm trong dấu ngoặc kép/đơn/thông minh THEN hệ thống PHẢI
   dùng cụm đó làm Text_Target.
2. IF prompt KHÔNG chứa cụm được trích rõ ràng THEN hệ thống PHẢI trả về None
   (không Text_Target) VÀ để LLM xử lý.
3. Text_Target PHẢI hỗ trợ Unicode (ví dụ tiếng Việt "Đăng nhập").

### Requirement 3 — Khớp văn bản bảo thủ (an toàn)

**User Story:** As a user, I want the matcher to avoid clicking the wrong control,
so that near-misses defer to the LLM instead of acting incorrectly.

#### Acceptance Criteria

1. Match_Score PHẢI = 1.0 khi text khớp chính xác (sau khi chuẩn hóa
   chữ thường + bỏ dấu câu bao quanh + gộp khoảng trắng).
2. Match_Score PHẢI = 0.9 khi Text_Target xuất hiện như một từ độc lập trong text box.
3. Match_Score PHẢI = 0.75 khi là substring có nghĩa (độ dài ≥ 3) nhưng không
   phải từ độc lập.
4. Match_Score PHẢI = 0.0 khi không khớp; KHÔNG dùng fuzzy edit-distance để
   tránh khớp nhầm.
5. WHEN nhiều text box khớp THEN hệ thống PHẢI chọn box có Combined_Confidence cao nhất.

### Requirement 4 — Tọa độ & ROI nhất quán

**User Story:** As a user, I want local hits to return the same coordinate space
as LLM hits, so that ROI cropping behaves identically.

#### Acceptance Criteria

1. WHEN ROI được dùng THEN tọa độ hit cục bộ PHẢI được cộng offset ROI để trở về
   không gian toàn màn hình (giống nhánh LLM).
2. Tọa độ trả về PHẢI là tâm (center) của text box, là số nguyên.

### Requirement 5 — Degrade gracefully (optional dependency)

**User Story:** As an operator, I want automation to keep working when Tesseract
is absent, so that the feature is never a hard dependency.

#### Acceptance Criteria

1. IF `pytesseract` không import được OR binary `tesseract` không chạy được THEN
   `is_available()` PHẢI trả về False.
2. WHEN OCR_Engine không khả dụng THEN `analyze()` PHẢI tự dùng LLM mà KHÔNG raise.
3. Bất kỳ lỗi nào trong lượt OCR PHẢI được nuốt và chuyển thành Fallback, KHÔNG
   làm hỏng `analyze()`.

### Requirement 6 — Telemetry tiết kiệm token

**User Story:** As a maintainer, I want to quantify savings, so that I can prove
the optimization works.

#### Acceptance Criteria

1. Hệ thống PHẢI tăng `local_ocr_hits` mỗi khi một hit cục bộ thay cho một lệnh LLM.
2. Hệ thống PHẢI tăng `llm_calls` mỗi khi thực sự gọi LLM.
3. Có thể bật/tắt nhánh OCR qua `set_local_ocr_enabled(bool)`; khi tắt, hệ thống
   PHẢI luôn dùng LLM.
