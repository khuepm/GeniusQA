# Yêu cầu chi tiết — GeniusQA Upgrade

## REQ-1: Refactor Kiến trúc

### REQ-1.1: Phân tách Automation Core
- **Mô tả**: Rust là automation engine duy nhất (recorder + player + OS-level control)
- **Hiện trạng**: Cả Python và Rust đều có recorder + player
- **Yêu cầu**:
  - Rust recorder/player xử lý 100% action types hiện tại
  - Đảm bảo feature parity: tất cả features trong Python player phải có ở Rust
  - Bao gồm: variable substitution, speed control, looping, ESC abort, step-based execution
- **Acceptance Criteria**:
  - [ ] Tất cả test scripts hiện tại chạy được với Rust core
  - [ ] Không có regression trong record/playback
  - [ ] Python recorder/player được đánh dấu deprecated

### REQ-1.2: Đơn giản hóa Core Router
- **Mô tả**: Bỏ dual-core selection logic, Rust là mặc định
- **Hiện trạng**: `core_router.rs` (96K) quản lý 2 core + fallback + health checks
- **Yêu cầu**:
  - Bỏ Python core health checks cho automation
  - Bỏ fallback logic Python ↔ Rust cho recorder/player
  - Giữ IPC bridge tới Python cho AI layer
- **Acceptance Criteria**:
  - [ ] `core_router.rs` giảm xuống ≤30K
  - [ ] CoreSelector UI component đã xóa
  - [ ] IPC bridge tới Python vẫn hoạt động cho AI commands

### REQ-1.3: Chuyển AI từ Rust sang Python
- **Mô tả**: AI test case generation chuyển từ Rust `ai_test_case/` sang Python deepagents
- **Hiện trạng**: `ai_test_case/service.rs` (93K) + monitoring (64K) + validation (46K) trong Rust
- **Yêu cầu**:
  - Export spec/interface từ Rust AI module
  - Implement lại với deepagents framework trong Python
  - Rust module gọi Python thay vì tự xử lý AI
- **Acceptance Criteria**:
  - [ ] Python AI module sinh test cases tương đương Rust module
  - [ ] Rust `ai_test_case/` commands delegate sang Python
  - [ ] Tất cả AI integration tests pass

### REQ-1.4: Refactor IPC Protocol
- **Mô tả**: Phân chia commands rõ ràng: Rust xử lý automation, Python xử lý AI
- **Hiện trạng**: Python IPC handler xử lý cả recording, playback, storage, AI
- **Yêu cầu**:
  - Recording/playback commands → Rust trực tiếp (không qua Python)
  - AI commands → Python (analyze, generate, execute_ai_test)
  - Storage commands → giữ ở Python
  - Versioned protocol (v2) backward-compatible với v1
- **Acceptance Criteria**:
  - [ ] IPC Protocol v2 spec documented
  - [ ] Frontend gọi đúng target (Rust vs Python) cho mỗi command
  - [ ] Backward compatibility: v1 commands vẫn hoạt động

### REQ-1.5: Xóa Code Thừa
- **Mô tả**: Xóa Python automation code và Rust duplicate
- **Danh sách xóa**:
  - `packages/python-core/src/recorder/recorder.py` (27K)
  - `packages/python-core/src/player/player.py` (72K)
  - `packages/python-core/src/player/performance_optimizations.py` (15K)
  - `packages/desktop/src/components/CoreSelector/` (UI component)
- **Yêu cầu**:
  - Port critical Python tests sang Rust trước khi xóa
  - Đảm bảo storage/models vẫn compatible
- **Acceptance Criteria**:
  - [ ] Các file trên đã xóa
  - [ ] Không có import nào reference tới modules đã xóa
  - [ ] Test suite pass (after porting relevant tests)

---

## REQ-2: Deep AI Integration (deepagents)

### REQ-2.1: LangGraph Agent Graph
- **Mô tả**: Xây dựng AI agent graph với 5 nodes: Analyze, Plan, Generate, Execute, Debug
- **Yêu cầu**:
  - Node 1 (Analyze): Nhận recording JSON → output semantic actions + detected flow
  - Node 2 (Plan): deepagents `write_todos` → list test case descriptions
  - Node 3 (Generate): Sinh TestCase objects (TestStep + Action)
  - Node 4 (Execute): Gọi tools (Rust/playwright-mcp) → PASS/FAIL
  - Node 5 (Debug): Khi FAIL → AI phân tích lỗi → retry (max 3 lần)
  - Conditional edges: Execute → Debug (FAIL) → Execute (retry) hoặc → Report (PASS/max retry)
- **Acceptance Criteria**:
  - [ ] Agent graph definition trong `ai/agent.py`
  - [ ] State schema trong `ai/state.py`
  - [ ] Mỗi node có unit test
  - [ ] Integration test: recording → 3+ test cases → execute → report

### REQ-2.2: Tool Registry
- **Mô tả**: Register tools cho deepagents agent
- **Yêu cầu**:
  - Rust tools: `rust_start_recording`, `rust_stop_recording`, `rust_playback`, `rust_screenshot`
  - Browser tools: `browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_assert`
  - Vision tools: `vision_find_element`, `vision_compare`
  - Memory tools: `memory_recall`, `memory_store`
- **Acceptance Criteria**:
  - [ ] Mỗi tool có description, params, execute function
  - [ ] Agent call được tất cả tools thành công
  - [ ] Error handling cho mỗi tool (timeout, connection error)

### REQ-2.3: mem0 Context Memory
- **Mô tả**: Tích hợp mem0 để AI nhớ context xuyên phiên
- **Yêu cầu**:
  - Lưu test results sau mỗi run
  - Lưu bug patterns, element changes
  - Recall context trước mỗi test run mới
  - Configurable: user bật/tắt memory
- **Acceptance Criteria**:
  - [ ] mem0 integration trong `ai/memory/context.py`
  - [ ] Dữ liệu persist giữa sessions
  - [ ] Agent sử dụng recalled context để cải thiện test generation
  - [ ] Có option disable memory trong settings

### REQ-2.4: Recording Analysis
- **Mô tả**: AI phân tích recording JSON → hiểu user intent
- **Yêu cầu**:
  - Input: recording JSON + screenshots
  - Output: semantic actions (intent, element, selector_hint), detected flow type
  - Sử dụng Gemini 2.0 Flash (đã có API key)
  - Multimodal: gửi screenshots cùng action data
- **Acceptance Criteria**:
  - [ ] Phân tích được: login flow, form submission, navigation, CRUD operations
  - [ ] Gắn semantic label cho ≥80% actions
  - [ ] Detect được flow type chính xác
  - [ ] Response time ≤10s cho recording 20 actions

### REQ-2.5: Test Case Generation
- **Mô tả**: AI sinh test cases từ analysis kết quả
- **Yêu cầu**:
  - Happy path (replay flow gốc)
  - Negative tests (wrong input, empty fields)
  - Edge cases (special characters, long strings, SQL injection)
  - Boundary tests (max length, zero values)
  - Output format: compatible với GeniusQA TestScript schema
- **Acceptance Criteria**:
  - [ ] Sinh ≥3 test cases từ mỗi recording
  - [ ] Test cases output đúng format TestScript/TestStep/Action
  - [ ] Generated test cases executable bởi Rust player hoặc playwright-mcp

---

## REQ-3: Execution Engine

### REQ-3.1: Option A — Browser CDP (playwright-mcp)
- **Mô tả**: Browser automation không chiếm chuột qua CDP protocol
- **Yêu cầu**:
  - Spawn playwright-mcp server từ Python
  - AI agent gọi browser tools qua MCP protocol
  - Support: navigate, click, type, fill_form, select, screenshot, wait, assert
  - Multi-tab, multi-browser support
  - Error handling: element not found, timeout, page error
- **Acceptance Criteria**:
  - [ ] playwright-mcp server spawn/stop từ Python
  - [ ] AI agent execute test case qua browser tools
  - [ ] Test login flow trên web app thực tế
  - [ ] Assertion: URL check, text check, element visibility

### REQ-3.2: Option B — OS-Level Input (Rust)
- **Mô tả**: Automation chiếm chuột/bàn phím qua Rust OS-level APIs
- **Yêu cầu**:
  - AI agent gọi Rust tools qua IPC
  - AI Vision loop: screenshot → Gemini detect → Rust click → verify
  - Application focus tracking (đã có trong Rust)
  - Support: click, type, key_press, scroll, screenshot, window_focus
- **Acceptance Criteria**:
  - [ ] AI agent gọi được Rust tools từ Python
  - [ ] AI Vision loop hoạt động: detect → click → verify
  - [ ] Playback trên browser bằng OS-level input
  - [ ] Focus monitoring prevents actions on wrong window

### REQ-3.3: Option C — Hybrid Mode
- **Mô tả**: AI tự chọn CDP hoặc OS-level cho mỗi action
- **Yêu cầu**:
  - Execution router quyết định mode per action
  - Rule-based + AI-based mode selection
  - Seamless transition: CDP → OS-level → CDP trong cùng flow
  - Unified result format từ cả 2 modes
- **Acceptance Criteria**:
  - [ ] Router chọn đúng mode cho common scenarios
  - [ ] File upload flow: CDP click button → OS-level dialog → CDP continue
  - [ ] Unified test result bất kể execution mode
  - [ ] User có thể override mode selection trong UI

### REQ-3.4: Recording Format Enhancement
- **Mô tả**: Mở rộng recording format với context metadata
- **Yêu cầu**:
  - Thêm window context: title, process name, bounds
  - Thêm screen resolution, platform info
  - Action grouping (semantic groups)
  - Backward compatible với format cũ
- **Acceptance Criteria**:
  - [ ] Recording format v2 spec documented
  - [ ] Rust recorder output new format
  - [ ] AI analyzer sử dụng context metadata
  - [ ] Old recordings vẫn loadable (migration)

### REQ-3.5: UI Components cho Execution Engine
- **Mô tả**: UI mới cho browser automation và AI agent
- **Yêu cầu**:
  - AI Dashboard: trạng thái agent, đang chạy test nào, results
  - Browser Panel: chọn mode (A/B/C), browser target
  - Test Case Viewer: xem/edit/approve test cases AI sinh ra
  - Recording Analysis View: hiển thị AI hiểu recording thế nào
- **Acceptance Criteria**:
  - [ ] AI Dashboard component hiển thị real-time agent status
  - [ ] Browser Panel cho phép chọn execution mode
  - [ ] Test Case Viewer cho phép approve/reject/edit generated tests
  - [ ] Recording Analysis hiển thị semantic labels trên actions

---

## REQ-4: Non-Functional Requirements

### REQ-4.1: Performance
- AI analysis response time: ≤10s cho 20 actions
- Test case generation: ≤15s cho 5 test cases
- Browser CDP execution: ≤2s per action
- OS-level execution: ≤1s per action (không tính AI Vision)
- AI Vision detection: ≤5s per element

### REQ-4.2: Reliability
- AI agent retry: max 3 lần cho failed test
- playwright-mcp auto-restart khi crash
- Rust IPC timeout: 30s per command
- Graceful degradation: nếu AI unavailable, manual mode vẫn hoạt động

### REQ-4.3: Security
- API keys (Gemini) lưu trong keyring (đã có)
- mem0 data local-only (không gửi lên cloud)
- playwright-mcp chạy local, không expose port bên ngoài
- Không gửi screenshot lên server ngoài (trừ Gemini API cho AI Vision)

### REQ-4.4: Compatibility
- Backward compatible: scripts cũ vẫn chạy được
- IPC protocol v2 backward compatible với v1
- Recording format v2 backward compatible
- Support: macOS, Windows, Linux (Rust core)
- Browser: Chrome, Firefox, WebKit (playwright-mcp)
