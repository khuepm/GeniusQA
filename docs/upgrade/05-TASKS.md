# Task Breakdown — GeniusQA Upgrade

## Tổng quan Phases & Dependencies

```
Phase 1: Architecture Refactor
  ├── Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4 → Task 1.5
  │                                                     │
Phase 2: AI Integration (bắt đầu sau Task 1.3)         │
  ├── Task 2.1 → Task 2.2 → Task 2.4 → Task 2.5      │
  │         └── Task 2.3 (parallel)                     │
  │                                                     │
Phase 3: Execution Engine (bắt đầu sau Task 2.2)       │
  ├── Task 3.1 (Option A) ──┐                          │
  ├── Task 3.2 (Option B) ──┼── Task 3.3 (Hybrid)     │
  ├── Task 3.4 (Recording) ─┘       │                  │
  └── Task 3.5 (UI) ────────────────┘                  │
```

---

## Phase 1: Architecture Refactor

### Task 1.1: Audit Feature Parity (Rust vs Python)
- **Mục tiêu**: Xác nhận Rust core có đầy đủ features so với Python
- **Subtasks**:
  - [ ] 1.1.1: Liệt kê tất cả action types Python player hỗ trợ
  - [ ] 1.1.2: Liệt kê tất cả action types Rust player hỗ trợ
  - [ ] 1.1.3: So sánh → xác định gaps
  - [ ] 1.1.4: Kiểm tra: variable substitution trong Rust
  - [ ] 1.1.5: Kiểm tra: speed control trong Rust
  - [ ] 1.1.6: Kiểm tra: loop execution trong Rust
  - [ ] 1.1.7: Kiểm tra: ESC abort trong Rust
  - [ ] 1.1.8: Kiểm tra: step-based execution + callbacks trong Rust
  - [ ] 1.1.9: Kiểm tra: screenshot capture on click trong Rust recorder
  - [ ] 1.1.10: Document gaps và plan để fill
- **Output**: Feature parity report (checklist)
- **Dependency**: Không có
- **Ước lượng**: Phân tích + gap document

### Task 1.2: Fill Rust Feature Gaps
- **Mục tiêu**: Implement missing features trong Rust core
- **Subtasks**:
  - [ ] 1.2.1: Implement missing features từ gap analysis (Task 1.1)
  - [ ] 1.2.2: Port relevant Python tests sang Rust
  - [ ] 1.2.3: Run full test suite — tất cả pass
  - [ ] 1.2.4: Manual test: record flow → playback bằng Rust → xác nhận hoạt động
- **Output**: Rust core feature-complete
- **Dependency**: Task 1.1

### Task 1.3: Simplify Core Router
- **Mục tiêu**: Bỏ dual-core logic, Rust là mặc định
- **Subtasks**:
  - [ ] 1.3.1: Refactor `core_router.rs`: bỏ Python core selection cho automation
  - [ ] 1.3.2: Giữ IPC bridge tới Python cho AI layer
  - [ ] 1.3.3: Xóa `CoreSelector` UI component
  - [ ] 1.3.4: Update frontend: remove core selection UI
  - [ ] 1.3.5: Update Tauri commands: remove core switch commands
  - [ ] 1.3.6: Test: recording/playback qua simplified router
- **Output**: `core_router.rs` đơn giản hóa (≤30K)
- **Dependency**: Task 1.2

### Task 1.4: Refactor IPC Protocol v2
- **Mục tiêu**: Phân chia commands rõ ràng (Rust automation vs Python AI)
- **Subtasks**:
  - [ ] 1.4.1: Design IPC Protocol v2 spec
  - [ ] 1.4.2: Update Rust: recording/playback commands xử lý trực tiếp (không proxy qua Python)
  - [ ] 1.4.3: Update Python `ipc/handler.py`: bỏ recording/playback handlers
  - [ ] 1.4.4: Thêm AI commands vào IPC protocol: `analyze_recording`, `generate_test_cases`, `execute_ai_test`
  - [ ] 1.4.5: Update frontend: gọi đúng target cho mỗi command
  - [ ] 1.4.6: Backward compatibility: v1 commands vẫn route đúng
  - [ ] 1.4.7: Update `IPC_PROTOCOL.md`
- **Output**: IPC Protocol v2 working
- **Dependency**: Task 1.3

### Task 1.5: Remove Deprecated Python Code
- **Mục tiêu**: Xóa code trùng lặp
- **Subtasks**:
  - [ ] 1.5.1: Xóa `recorder/recorder.py` (giữ `__init__.py` trống hoặc xóa thư mục)
  - [ ] 1.5.2: Xóa `player/player.py` và `performance_optimizations.py`
  - [ ] 1.5.3: Update imports: tất cả references tới recorder/player đã removed
  - [ ] 1.5.4: Xóa unused Python dependencies: `pyautogui`, `pynput`, `keyboard`, `mouse`
  - [ ] 1.5.5: Update `requirements.txt`
  - [ ] 1.5.6: Run full test suite — xóa hoặc update broken tests
  - [ ] 1.5.7: Update documentation: ARCHITECTURE.md, README
- **Output**: Codebase clean, không còn duplicate
- **Dependency**: Task 1.4

---

## Phase 2: AI Integration

### Task 2.1: Setup deepagents + LangGraph
- **Mục tiêu**: Tạo AI agent framework trong Python
- **Subtasks**:
  - [ ] 2.1.1: Thêm dependencies: `deepagents`, `langgraph`, `langchain-core`, `langchain-google-genai`
  - [ ] 2.1.2: Tạo `packages/python-core/src/ai/` directory structure
  - [ ] 2.1.3: Define `AgentState` schema (`ai/state.py`)
  - [ ] 2.1.4: Implement Node 1: Analyze (`ai/nodes/analyze.py`)
  - [ ] 2.1.5: Implement Node 2: Plan (`ai/nodes/plan.py`)
  - [ ] 2.1.6: Implement Node 3: Generate (`ai/nodes/generate.py`)
  - [ ] 2.1.7: Implement Node 4: Execute (`ai/nodes/execute.py`) — stub (cần tools)
  - [ ] 2.1.8: Implement Node 5: Debug (`ai/nodes/debug.py`)
  - [ ] 2.1.9: Wire up graph with conditional edges (`ai/agent.py`)
  - [ ] 2.1.10: Unit tests cho mỗi node
  - [ ] 2.1.11: Integration test: mock recording → sinh test cases
- **Output**: LangGraph agent graph functional (với mock tools)
- **Dependency**: Task 1.4 (IPC v2 cần sẵn sàng)

### Task 2.2: Implement Tool Registry
- **Mục tiêu**: Register tất cả tools cho agent
- **Subtasks**:
  - [ ] 2.2.1: Implement Rust tools (`ai/tools/rust_tools.py`): gọi Rust via IPC
  - [ ] 2.2.2: Implement browser tools (`ai/tools/browser_tools.py`): gọi playwright-mcp
  - [ ] 2.2.3: Implement vision tools (`ai/tools/vision_tools.py`): wrap `ai_vision_service.py`
  - [ ] 2.2.4: Implement memory tools (`ai/tools/memory_tools.py`): mem0 wrapper
  - [ ] 2.2.5: Register tools vào agent graph
  - [ ] 2.2.6: Unit tests: mỗi tool callable + error handling
  - [ ] 2.2.7: Integration test: agent graph + real tools (Rust IPC)
- **Output**: Agent có thể gọi tất cả tools
- **Dependency**: Task 2.1

### Task 2.3: mem0 Context Memory (parallel với 2.2)
- **Mục tiêu**: Tích hợp mem0 cho long-term memory
- **Subtasks**:
  - [ ] 2.3.1: Thêm `mem0ai` dependency
  - [ ] 2.3.2: Implement `ai/memory/context.py`: init, add, search, list
  - [ ] 2.3.3: Define memory types: test_result, bug_pattern, element_change, app_knowledge
  - [ ] 2.3.4: Hook vào agent: recall trước test, store sau test
  - [ ] 2.3.5: Settings: user bật/tắt memory, clear history
  - [ ] 2.3.6: Unit tests: CRUD memory operations
  - [ ] 2.3.7: Integration test: agent sử dụng recalled context
- **Output**: mem0 working, agent sử dụng memory
- **Dependency**: Task 2.1 (cần agent graph structure)

### Task 2.4: Recording Analysis AI
- **Mục tiêu**: AI phân tích recording → semantic understanding
- **Subtasks**:
  - [ ] 2.4.1: Implement `vision/intent_analyzer.py`: multimodal analysis (JSON + screenshots)
  - [ ] 2.4.2: Prompt engineering: recording JSON → semantic actions
  - [ ] 2.4.3: Flow detection: login, form_submission, navigation, CRUD, checkout
  - [ ] 2.4.4: Selector hint generation: từ screenshots → CSS selectors
  - [ ] 2.4.5: Wire vào Node 1 (Analyze) trong agent graph
  - [ ] 2.4.6: Test với 5+ recording samples
  - [ ] 2.4.7: Benchmark: accuracy, response time
- **Output**: AI analysis ≥80% accuracy
- **Dependency**: Task 2.1

### Task 2.5: Test Case Generation AI
- **Mô tả**: AI sinh test cases từ analysis
- **Subtasks**:
  - [ ] 2.5.1: Define test case generation prompts
  - [ ] 2.5.2: Happy path generation
  - [ ] 2.5.3: Negative test generation (wrong input, empty)
  - [ ] 2.5.4: Edge case generation (special chars, long strings, injection)
  - [ ] 2.5.5: Output conversion → GeniusQA TestScript format
  - [ ] 2.5.6: Wire vào Node 2+3 (Plan + Generate) trong agent graph
  - [ ] 2.5.7: Test: sinh ≥3 test cases per recording
  - [ ] 2.5.8: Validate: generated tests compilable + executable
- **Output**: AI sinh test cases đúng format, executable
- **Dependency**: Task 2.4

---

## Phase 3: Execution Engine

### Task 3.1: Option A — playwright-mcp Integration
- **Mục tiêu**: Browser automation qua CDP protocol
- **Subtasks**:
  - [ ] 3.1.1: Implement `mcp/client.py`: spawn/stop playwright-mcp process
  - [ ] 3.1.2: Implement `mcp/playwright.py`: tool wrappers (navigate, click, type, assert)
  - [ ] 3.1.3: Tích hợp `langchain-mcp-adapters` cho seamless agent integration
  - [ ] 3.1.4: Error handling: element not found, timeout, process crash, auto-restart
  - [ ] 3.1.5: Test: navigate → fill form → submit → assert result
  - [ ] 3.1.6: Test: multi-tab scenario
  - [ ] 3.1.7: Test: headless mode cho CI/CD
  - [ ] 3.1.8: Performance benchmark: actions per second
- **Output**: Browser automation qua CDP working end-to-end
- **Dependency**: Task 2.2 (cần tool registry)

### Task 3.2: Option B — OS-Level Execution Enhancement
- **Mục tiêu**: AI-driven OS-level automation
- **Subtasks**:
  - [ ] 3.2.1: Mở rộng Rust IPC: nhận AI commands (click_at, type_text, screenshot_capture)
  - [ ] 3.2.2: Implement AI Vision loop trong Python: screenshot → detect → command → verify
  - [ ] 3.2.3: Wire Rust tools vào agent graph
  - [ ] 3.2.4: Focus management: ensure actions target correct window
  - [ ] 3.2.5: Test: browser interaction qua OS-level
  - [ ] 3.2.6: Test: native dialog interaction (file upload)
  - [ ] 3.2.7: Test: desktop application interaction
  - [ ] 3.2.8: Performance benchmark: AI Vision round-trip time
- **Output**: OS-level AI automation working
- **Dependency**: Task 2.2, Task 1.2 (Rust core complete)

### Task 3.3: Option C — Hybrid Execution Router
- **Mục tiêu**: AI chọn mode tốt nhất cho mỗi action
- **Subtasks**:
  - [ ] 3.3.1: Implement execution router (`ai/nodes/execute.py` enhancement)
  - [ ] 3.3.2: Rule-based mode selection (browser actions → CDP, OS actions → Rust)
  - [ ] 3.3.3: Handle transitions: CDP → OS-level → CDP trong cùng flow
  - [ ] 3.3.4: Unified result format từ cả 2 modes
  - [ ] 3.3.5: AI-based mode selection (optional, enhance rule-based)
  - [ ] 3.3.6: Test: web app with file upload (hybrid scenario)
  - [ ] 3.3.7: Test: complex flow crossing browser + desktop
  - [ ] 3.3.8: User override: force mode selection trong UI
- **Output**: Hybrid mode working, AI chọn mode tự động
- **Dependency**: Task 3.1 + Task 3.2

### Task 3.4: Recording Format v2
- **Mục tiêu**: Mở rộng recording với context metadata
- **Subtasks**:
  - [ ] 3.4.1: Design recording format v2 schema
  - [ ] 3.4.2: Update Rust recorder: capture window context (title, process, bounds)
  - [ ] 3.4.3: Add platform + resolution metadata
  - [ ] 3.4.4: Action grouping logic
  - [ ] 3.4.5: Migration: v1 → v2 automatic conversion
  - [ ] 3.4.6: Update AI analyzer: use new metadata
  - [ ] 3.4.7: Test: old recordings load correctly (backward compat)
  - [ ] 3.4.8: Update storage/models for v2 format
- **Output**: Recording v2 with rich metadata
- **Dependency**: Task 1.2 (Rust core complete)

### Task 3.5: UI Components cho Execution Engine
- **Mục tiêu**: Frontend UI cho AI agent và browser automation
- **Subtasks**:
  - [ ] 3.5.1: `AIAgentDashboard` component: agent status, current test, results timeline
  - [ ] 3.5.2: `BrowserAutomationPanel` component: mode selection (A/B/C), browser target
  - [ ] 3.5.3: `TestCaseViewer` component: list generated tests, approve/edit/reject
  - [ ] 3.5.4: `RecordingAnalysisView` component: semantic labels overlay trên recording
  - [ ] 3.5.5: Integrate components vào EnhancedScriptEditorScreen
  - [ ] 3.5.6: Wire up Tauri IPC calls cho AI commands
  - [ ] 3.5.7: Real-time updates: agent events → UI via Tauri events
  - [ ] 3.5.8: Unit tests cho tất cả components
- **Output**: Full UI cho AI-powered testing
- **Dependency**: Task 2.1 (AI agent commands), Task 3.3 (execution modes)

---

## Thứ tự thực hiện đề xuất

### Sprint 1: Foundation
```
Task 1.1 (Audit) → Task 1.2 (Fill gaps) → Task 1.3 (Simplify router)
```

### Sprint 2: Architecture Clean
```
Task 1.4 (IPC v2) → Task 1.5 (Remove deprecated)
```

### Sprint 3: AI Framework
```
Task 2.1 (deepagents setup) + Task 2.3 (mem0, parallel)
```

### Sprint 4: AI Intelligence
```
Task 2.2 (Tool registry) → Task 2.4 (Recording analysis) → Task 2.5 (Test gen)
```

### Sprint 5: Browser Automation
```
Task 3.1 (Option A: CDP) + Task 3.2 (Option B: OS-level, parallel)
Task 3.4 (Recording v2, parallel)
```

### Sprint 6: Integration & Polish
```
Task 3.3 (Hybrid mode) → Task 3.5 (UI components)
```

---

## Dependency Graph

```
1.1 ──► 1.2 ──► 1.3 ──► 1.4 ──► 1.5
                         │
                         ▼
                        2.1 ──► 2.2 ──► 2.4 ──► 2.5
                         │       │
                         ▼       ▼
                        2.3    3.1 (Option A)
                               3.2 (Option B)
                                │
                                ▼
                        3.4    3.3 (Hybrid)
                         │       │
                         ▼       ▼
                              3.5 (UI)
```

## Risk Items

| Task | Risk | Mitigation |
|------|------|------------|
| Task 1.2 | Rust feature gaps lớn hơn dự kiến | Audit kỹ trước, estimate lại sau Task 1.1 |
| Task 2.1 | deepagents API chưa ổn định | Dùng LangGraph trực tiếp nếu deepagents có issue |
| Task 2.4 | AI accuracy thấp cho recording analysis | Prompt engineering + few-shot examples + fallback manual |
| Task 3.1 | playwright-mcp version conflicts | Pin version, test trước khi integrate |
| Task 3.3 | Hybrid mode transitions phức tạp | Bắt đầu với rule-based đơn giản, AI-based sau |
