# Phase 3: Execution Engine — Recording → AI → Execution

## 1. Tổng quan luồng end-to-end

```
┌────────────────┐     ┌────────────────┐     ┌────────────────────────┐
│   RECORDING    │     │   AI ENGINE    │     │   EXECUTION ENGINE     │
│                │     │                │     │                        │
│  Rust recorder │────►│  deepagents    │────►│  Option A: CDP         │
│  (OS-level     │     │  agent graph   │     │  (playwright-mcp)      │
│   input events)│     │                │     │                        │
│                │     │  1. Analyze    │     │  Option B: OS-level    │
│  Output:       │     │  2. Plan       │     │  (Rust input sim)      │
│  recording.json│     │  3. Generate   │     │                        │
│  + screenshots │     │  4. Execute    │     │  Option C: Hybrid      │
│                │     │  5. Report     │     │  (A + B combined)      │
└────────────────┘     └────────────────┘     └────────────────────────┘
```

## 2. Recording Engine (Rust)

### 2.1. Hiện trạng

Rust recorder đã có:
- Mouse events: click, move, scroll (qua `rdev`)
- Keyboard events: key press, key release (qua `rdev`)
- Screenshot capture trên click
- Platform-specific: macOS (`core-graphics`), Windows (`winapi`), Linux (`x11`)
- Application focus tracking (`focus_monitor.rs`)

### 2.2. Cần bổ sung cho AI integration

| Feature | Mô tả | Tại sao |
|---------|--------|---------|
| **Semantic labeling** | Gắn label cho mỗi action (ví dụ: "click on email field") | AI cần hiểu intent, không chỉ coordinates |
| **DOM snapshot** | Nếu target là browser, capture DOM cùng lúc | AI sinh selector thay vì dùng (x,y) |
| **Window context** | Lưu window title, process name cho mỗi action | AI biết đang thao tác trên app nào |
| **Action grouping** | Nhóm actions liên quan (type email → click next) | AI hiểu flow dễ hơn |

### 2.3. Recording output format mới

```json
{
  "meta": {
    "id": "rec_20260418_143000",
    "start_time": "2026-04-18T14:30:00Z",
    "end_time": "2026-04-18T14:35:00Z",
    "platform": "macos",
    "screen_resolution": [2560, 1440]
  },
  "actions": [
    {
      "id": "act_001",
      "type": "click",
      "timestamp": 1500,
      "position": {"x": 450, "y": 310},
      "button": "left",
      "screenshot": "screenshots/shot_001.png",
      "context": {
        "window_title": "Example App - Login",
        "process_name": "chrome",
        "window_bounds": {"x": 0, "y": 0, "w": 1920, "h": 1080}
      }
    },
    {
      "id": "act_002",
      "type": "type",
      "timestamp": 2100,
      "text": "admin@test.com",
      "screenshot": "screenshots/shot_002.png",
      "context": {
        "window_title": "Example App - Login",
        "process_name": "chrome"
      }
    }
  ]
}
```

## 3. Execution Engine — Option A: CDP Protocol (Không chiếm chuột)

### 3.1. Kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│                    MÁY TÍNH CỦA USER                         │
│                                                              │
│  ┌─────────────────┐        ┌──────────────────────────────┐ │
│  │   GeniusQA      │  MCP   │  playwright-mcp server       │ │
│  │  Python AI      │◄──────►│  (local process)             │ │
│  │  Layer          │ stdio  │                              │ │
│  │                 │        │  Điều khiển qua Chrome       │ │
│  │  AI agent gọi:  │        │  DevTools Protocol (CDP):    │ │
│  │  browser_click  │        │  - DOM manipulation          │ │
│  │  browser_type   │        │  - JavaScript execution      │ │
│  │  browser_snap   │        │  - Network interception      │ │
│  │  browser_assert │        │  - Screenshot                │ │
│  └─────────────────┘        └──────────────┬───────────────┘ │
│                                            │ CDP              │
│                                   ┌────────▼────────┐        │
│                                   │  Chrome/Firefox  │        │
│                                   │  (real browser)  │        │
│                                   │                  │        │
│                                   │  User CÓ THỂ    │        │
│                                   │  dùng chuột      │        │
│                                   │  cho việc khác   │        │
│                                   └─────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

### 3.2. playwright-mcp tools available

| Tool | Chức năng | Params |
|------|----------|--------|
| `browser_navigate` | Mở URL | `url` |
| `browser_click` | Click element | `element` (text description), `ref` (DOM ref) |
| `browser_type` | Gõ text vào element | `element`, `ref`, `text` |
| `browser_fill_form` | Điền form nhiều field | `fields[]` |
| `browser_select_option` | Chọn dropdown | `element`, `ref`, `values[]` |
| `browser_snapshot` | Lấy accessibility tree | (none) |
| `browser_take_screenshot` | Chụp ảnh page | `fullPage`, `element` |
| `browser_press_key` | Nhấn phím | `key` |
| `browser_hover` | Hover element | `element`, `ref` |
| `browser_drag` | Drag & drop | `startElement`, `endElement` |
| `browser_evaluate` | Chạy JavaScript | `function` |
| `browser_handle_dialog` | Xử lý alert/confirm | `accept`, `promptText` |
| `browser_wait_for` | Đợi text/element | `text`, `time` |
| `browser_tabs` | Quản lý tabs | `action` (list/new/close/select) |

### 3.3. Ưu điểm & hạn chế Option A

| ✅ Ưu điểm | ❌ Hạn chế |
|------------|-----------|
| Không chiếm chuột/bàn phím | Chỉ hoạt động trong browser |
| Nhanh (DOM manipulation trực tiếp) | Không xử lý được native dialog (file upload OS-level) |
| Reliable (selector-based, không depend vào pixel) | Không detect được visual bugs (cần kết hợp screenshot) |
| Chạy headless được (CI/CD) | Một số web app phát hiện automation |
| Multi-tab, multi-browser | Shadow DOM phức tạp cần xử lý riêng |

### 3.4. Khi nào dùng Option A

- Test web application (phần lớn use cases)
- CI/CD pipeline (headless)
- Khi cần chạy test song song nhiều tab
- Khi user muốn dùng máy tính bình thường trong lúc test chạy

## 4. Execution Engine — Option B: OS-Level Input (Chiếm chuột)

### 4.1. Kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│                    MÁY TÍNH CỦA USER                         │
│                                                              │
│  ┌─────────────────┐                                         │
│  │   GeniusQA      │                                         │
│  │  Python AI      │                                         │
│  │  Layer          │                                         │
│  │                 │                                         │
│  │  AI agent gọi:  │        ┌──────────────────────────────┐ │
│  │  rust_playback  │──IPC──►│  Rust Automation Core        │ │
│  │  rust_click     │        │                              │ │
│  │  rust_type      │        │  OS-level input simulation:  │ │
│  │  rust_screenshot│        │  • rdev: mouse/keyboard      │ │
│  │                 │        │  • core-graphics (macOS)     │ │
│  │                 │        │  • winapi (Windows)          │ │
│  │                 │        │  • x11 (Linux)               │ │
│  └─────────────────┘        └──────────────┬───────────────┘ │
│                                            │ Real input       │
│                                            │ events           │
│                             ┌──────────────▼───────────────┐ │
│                             │       TOÀN BỘ OS             │ │
│                             │  • Browser                    │ │
│                             │  • Desktop apps               │ │
│                             │  • Native dialogs             │ │
│                             │  • File manager               │ │
│                             │                               │ │
│                             │  ⚠️ CHIẾM chuột + bàn phím   │ │
│                             │  User KHÔNG dùng được         │ │
│                             └───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.2. Rust Core capabilities cho OS-level

| Capability | Implementation | File |
|-----------|---------------|------|
| Mouse click | `rdev::simulate(EventType::ButtonPress)` | `playback_controller.rs` |
| Mouse move | `rdev::simulate(EventType::MouseMove)` | `playback_controller.rs` |
| Key press | `rdev::simulate(EventType::KeyPress)` | `playback_controller.rs` |
| Screenshot | `core-graphics::CGDisplay::image()` | platform-specific |
| Window focus | Accessibility APIs | `focus_monitor.rs` |
| App detection | Window enumeration | `platform/macos/mod.rs` |
| Visual diff | `image` + `imageproc` crates | (cần thêm) |

### 4.3. Kết hợp AI Vision cho OS-level

Khi dùng OS-level, không có DOM → cần AI Vision:

```
1. AI agent cần click "Login button"
   ↓
2. Rust: chụp screenshot hiện tại
   ↓
3. Python AI Vision: gửi screenshot + prompt "Find Login button" → Gemini
   ↓
4. Gemini trả về: {x: 450, y: 310, confidence: 0.95}
   ↓
5. Rust: simulate mouse click tại (450, 310)
   ↓
6. Rust: chụp screenshot mới → gửi lại AI xác nhận kết quả
```

### 4.4. Ưu điểm & hạn chế Option B

| ✅ Ưu điểm | ❌ Hạn chế |
|------------|-----------|
| Tương tác y hệt người thật | Chiếm chuột + bàn phím |
| Hoạt động với MỌI ứng dụng (không chỉ browser) | Chậm hơn CDP (cần AI vision cho mỗi action) |
| Native dialog, file upload, drag-drop thật | Phụ thuộc vào screen resolution |
| Không bị detect là automation | Không chạy headless được |
| Test end-to-end thực sự (OS → app → response) | Fail khi window bị che |

### 4.5. Khi nào dùng Option B

- Test desktop application (Electron, native app)
- Test native file upload dialog
- Khi web app detect và block CDP automation
- Khi cần test exact user experience (pixel-perfect)
- Khi test accessibility (screen reader interaction)

## 5. Execution Engine — Option C: Hybrid Mode

### 5.1. AI tự chọn mode cho mỗi action

```
┌─────────────────────────────────────────────────────────┐
│                   AI Agent (deepagents)                   │
│                                                          │
│   Với mỗi test step, AI quyết định mode:                │
│                                                          │
│   Step: "Navigate to login page"                         │
│   → Mode: CDP (playwright-mcp)                           │
│   → Lý do: web navigation, nhanh + reliable              │
│                                                          │
│   Step: "Enter email and password"                       │
│   → Mode: CDP (playwright-mcp)                           │
│   → Lý do: form fill, có DOM selector                    │
│                                                          │
│   Step: "Upload avatar file"                             │
│   → Mode: HYBRID                                        │
│   → CDP: click upload button                             │
│   → OS-level (Rust): tương tác native file dialog        │
│                                                          │
│   Step: "Verify email notification"                      │
│   → Mode: OS-level (Rust)                                │
│   → Lý do: cần mở email client (desktop app)             │
│                                                          │
│   Step: "Compare page with baseline screenshot"          │
│   → Mode: HYBRID                                        │
│   → CDP: screenshot browser page                         │
│   → AI Vision: so sánh visual regression                 │
└─────────────────────────────────────────────────────────┘
```

### 5.2. Decision logic trong AI agent

```python
# ai/nodes/execute.py

def choose_execution_mode(action: dict, context: dict) -> str:
    """AI hoặc rule-based logic chọn execution mode."""
    
    # Rule-based fallback
    if action["target"] == "browser" and action["type"] in ["navigate", "click", "type", "select"]:
        if action.get("native_dialog"):
            return "hybrid"  # CDP + OS-level
        return "browser_cdp"
    
    if action["target"] == "desktop_app":
        return "os_level"
    
    if action["type"] == "visual_assert":
        return "hybrid"  # Screenshot + AI comparison
    
    # AI quyết định khi rule không rõ
    return ai_decide_mode(action, context)
```

### 5.3. Execution flow hybrid

```
                    ┌─────────────┐
                    │  AI Agent    │
                    │  (Python)    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Execute     │
                    │  Router      │
                    └──┬───┬───┬──┘
                       │   │   │
            ┌──────────┘   │   └──────────┐
            ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────────┐
    │ CDP Mode  │  │ OS Mode   │  │ Hybrid Mode    │
    │           │  │           │  │                │
    │playwright │  │ Rust core │  │ CDP actions    │
    │-mcp       │  │ via IPC   │  │ + Rust for     │
    │           │  │           │  │   native parts │
    └───────────┘  └───────────┘  └───────────────┘
```

## 6. So sánh tổng hợp

| Tiêu chí | Option A (CDP) | Option B (OS-level) | Option C (Hybrid) |
|----------|----------------|--------------------|--------------------|
| **Tốc độ** | ⚡⚡⚡ Nhanh | ⚡ Chậm (AI vision per action) | ⚡⚡ Tùy action |
| **Reliability** | ⭐⭐⭐ Selector-based | ⭐⭐ Pixel-based | ⭐⭐⭐ Best of both |
| **Scope** | Browser only | Toàn OS | Toàn OS |
| **CI/CD** | ✅ Headless | ❌ Cần display | ⚠️ Partial |
| **Chiếm chuột** | ❌ Không | ✅ Có | ⚠️ Partial |
| **Native dialog** | ❌ Không | ✅ Có | ✅ Có |
| **Implementation** | Trung bình | Rust đã có phần lớn | Phức tạp nhất |
| **Đề xuất** | Mặc định cho web | Khi cần OS-level | Production target |

## 7. Các thư viện / framework bổ sung

### 7.1. Cho Option A (Browser CDP)

| Repo/Thư viện | Stars | Vai trò | Ưu tiên |
|---------------|-------|---------|---------|
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 31k | MCP server chính | **Bắt buộc** |
| [browserbase/stagehand](https://github.com/browserbase/stagehand) | 22k | TypeScript browser agent SDK | Tùy chọn — hữu ích nếu cần browser agent ở frontend |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) | 88k | Python AI browser agent | Tùy chọn — alternative cho playwright-mcp |

### 7.2. Cho Option B (OS-level)

| Thư viện / Crate | Vai trò | Status |
|-------------------|---------|--------|
| `rdev` (Rust) | Mouse/keyboard event simulation | **Đã có** trong Cargo.toml |
| `core-graphics` (Rust) | macOS screenshot, display info | **Đã có** |
| `winapi` (Rust) | Windows automation | **Đã có** |
| `x11` (Rust) | Linux display, input | **Đã có** |
| `image` + `imageproc` (Rust) | Visual diff, image processing | **Đã có** |
| [Skyvern-AI/skyvern](https://github.com/Skyvern-AI/skyvern) | Computer vision browser automation | Tham khảo approach |

### 7.3. Cho Option C (Hybrid)

Kết hợp tất cả dependencies từ Option A + B + thêm:

| Component | Vai trò |
|-----------|---------|
| Execution Router (Python) | Quyết định mode cho mỗi action |
| Action Adapter (Python) | Convert abstract action → mode-specific command |
| Result Aggregator (Python) | Merge results từ nhiều modes |

## 8. Implementation Roadmap

### 8.1. Iteration 1: Option A only (Browser CDP)

1. Setup playwright-mcp integration trong Python
2. AI agent gọi browser tools qua MCP
3. Test với web app đơn giản (login form)
4. Xử lý assertions: text, URL, element visibility

### 8.2. Iteration 2: Option B (OS-level qua Rust)

1. Mở rộng Rust IPC để nhận AI commands
2. AI agent gọi Rust tools (click, type, screenshot)
3. AI Vision loop: screenshot → detect → click → verify
4. Test với desktop app đơn giản

### 8.3. Iteration 3: Option C (Hybrid)

1. Build execution router trong AI agent
2. Rule-based mode selection
3. Handle transitions: browser → native dialog → browser
4. Test với complex flow (web app + file upload)

### 8.4. Iteration 4: Polish

1. AI-based mode selection (thay rule-based)
2. Parallel test execution (deepagents sub-agents)
3. Visual regression testing (screenshot comparison)
4. Performance optimization

## 9. Browser automation chi tiết cho Rust OS-level

### 9.1. Khi nào Rust tốt hơn thư viện khác cho browser OS-level?

| Scenario | Rust (rdev) | Skyvern (Python) | Verdict |
|----------|-------------|-------------------|---------|
| Click tại tọa độ biết trước | ⚡ Nanosec precision | 🐢 Process spawn overhead | **Rust** |
| Tìm element rồi click | Cần AI Vision round-trip | ✅ Built-in vision | **Skyvern** cho lần đầu, **Rust** cho replay |
| Keyboard input nhanh | ⚡ OS-level, zero delay | 🐢 Python overhead | **Rust** |
| Cross-platform | ✅ macOS + Windows + Linux | ⚠️ Chủ yếu Linux | **Rust** |
| File dialog interaction | ✅ Native APIs | ❌ Không hỗ trợ | **Rust** |

### 9.2. Đề xuất cho browser OS-level

**Rust là lựa chọn tốt nhất** cho OS-level browser automation vì:
1. Đã có sẵn trong GeniusQA (không thêm dependency)
2. Cross-platform (macOS, Windows, Linux)
3. Performance vượt trội (nanosecond precision)
4. Native dialog support (file upload, print, save-as)

**Kết hợp với AI Vision (Python)** để:
1. Tìm element trên screen bằng Gemini
2. Xác nhận action đã thành công bằng screenshot comparison
3. Self-healing: khi element thay đổi vị trí, AI tìm lại

## 10. Tiêu chí hoàn thành Phase 3

- [ ] Option A hoạt động: AI agent → playwright-mcp → browser automation
- [ ] Option B hoạt động: AI agent → Rust IPC → OS-level automation
- [ ] Option C hoạt động: Hybrid mode với execution router
- [ ] Recording format mới với context metadata
- [ ] AI Vision loop cho OS-level: screenshot → detect → action → verify
- [ ] Test trên web app: login flow end-to-end
- [ ] Test trên desktop interaction: file upload native dialog
- [ ] Performance benchmarks: CDP vs OS-level vs Hybrid
- [ ] User chọn được mode trong UI (hoặc AI tự chọn)
