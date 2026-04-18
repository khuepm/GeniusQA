# Phase 1: Refactor Kiến trúc — Phân định Python / Rust / TypeScript

## 1. Hiện trạng và vấn đề

### 1.1. Trùng lặp chức năng

Hiện tại cả Python và Rust đều implement recorder + player:

```
TRÙNG LẶP:
  Rust:   recorder (rdev, OS-level)     + player (playback_controller, 49K)
  Python: recorder (pynput, 27K)        + player (pyautogui, 72K)
```

**Vấn đề**:
- Mỗi bug fix / feature phải sửa ở 2 nơi
- `core_router.rs` (96K) phức tạp vì phải quản lý 2 core + fallback logic
- User bối rối khi chọn core (CoreSelector component)

### 1.2. AI chưa tham gia luồng chính

- `ai_vision_service.py` chỉ được gọi khi user chủ động chọn action type `ai_vision_capture`
- Luồng record → play thông thường không có AI tham gia
- Không có AI agent, không có test case generation tự động

### 1.3. Ranh giới ngôn ngữ không rõ

```
HIỆN TẠI:
  TypeScript: UI + một phần logic (scriptStorageService, stepSplitting...)
  Rust:       automation + IPC bridge + core router + AI test case generation
  Python:     automation + AI vision + IPC handler + storage

→ Cả 3 ngôn ngữ đều làm automation, không có ranh giới rõ ràng
```

## 2. Kiến trúc mục tiêu

### 2.1. Nguyên tắc phân chia

| Ngôn ngữ | Vai trò duy nhất | Lý do |
|-----------|-----------------|-------|
| **TypeScript** | UI/UX layer + IPC calls | React ecosystem, user interaction |
| **Rust** | Automation engine (OS-level) | Performance, platform APIs, đã mature |
| **Python** | AI brain + orchestration | AI ecosystem (deepagents, LangGraph, Gemini), rapid iteration |

### 2.2. Sơ đồ kiến trúc sau refactor

```
┌──────────────────────────────────────────────────────────────┐
│                  GeniusQA Desktop (Tauri)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              TypeScript / React UI                      │  │
│  │                                                        │  │
│  │  • EnhancedScriptEditorScreen (test step planner)      │  │
│  │  • ActionCanvas (action editing)                       │  │
│  │  • PlaybackControls (play/pause/stop)                  │  │
│  │  • AI Dashboard (agent status, test results)  [MỚI]    │  │
│  │  • Browser Automation Panel                   [MỚI]    │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │ Tauri IPC (invoke commands)           │
│  ┌────────────────────▼───────────────────────────────────┐  │
│  │              Rust Backend (src-tauri)                    │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐ │  │
│  │  │ Automation   │  │ AI Bridge     │  │ System      │ │  │
│  │  │ Engine       │  │ (→ Python)    │  │ Services    │ │  │
│  │  │              │  │               │  │             │ │  │
│  │  │ • recorder   │  │ • spawn AI    │  │ • window    │ │  │
│  │  │ • player     │  │   process     │  │   mgmt      │ │  │
│  │  │ • input sim  │  │ • IPC bridge  │  │ • focus     │ │  │
│  │  │ • screenshot │  │ • event relay │  │   monitor   │ │  │
│  │  │ • visual diff│  │               │  │ • notif     │ │  │
│  │  └──────────────┘  └───────┬───────┘  └─────────────┘ │  │
│  └────────────────────────────┼───────────────────────────┘  │
│                               │ stdin/stdout JSON IPC        │
│  ┌────────────────────────────▼───────────────────────────┐  │
│  │              Python AI Layer                            │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐ │  │
│  │  │ deepagents   │  │ AI Vision     │  │ Context     │ │  │
│  │  │ Agent        │  │ Service       │  │ Memory      │ │  │
│  │  │              │  │               │  │             │ │  │
│  │  │ • analyze    │  │ • Gemini 2.0  │  │ • mem0      │ │  │
│  │  │   recording  │  │ • element     │  │ • test      │ │  │
│  │  │ • gen test   │  │   detection   │  │   history   │ │  │
│  │  │   cases      │  │ • visual      │  │ • bug       │ │  │
│  │  │ • orchestrate│  │   comparison  │  │   patterns  │ │  │
│  │  │   execution  │  │               │  │             │ │  │
│  │  └──────────────┘  └───────────────┘  └─────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌───────────────┐                   │  │
│  │  │ MCP Client   │  │ Tool Registry │                   │  │
│  │  │              │  │               │                   │  │
│  │  │ • playwright │  │ • rust_record │                   │  │
│  │  │   -mcp       │  │ • rust_play   │                   │  │
│  │  │ • browser    │  │ • screenshot  │                   │  │
│  │  │   control    │  │ • file_ops    │                   │  │
│  │  └──────────────┘  └───────────────┘                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 3. Chi tiết refactor từng module

### 3.1. Python — XÓA automation, GIỮ AI

#### Xóa (chuyển sang Rust hoàn toàn):
| File | Size | Lý do xóa |
|------|------|-----------|
| `recorder/recorder.py` | 27K | Rust recorder đã mature hơn, dùng rdev (OS-level) |
| `player/player.py` | 72K | Rust player có focus monitoring, fallback, notification |
| `player/performance_optimizations.py` | 15K | Tối ưu cho pyautogui, không cần nữa |

#### Giữ và mở rộng:
| File | Size | Vai trò mới |
|------|------|------------|
| `vision/ai_vision_service.py` | 17K | Mở rộng: không chỉ tìm tọa độ, mà phân tích intent |
| `vision/image_utils.py` | 8K | Giữ nguyên |
| `storage/models.py` | 32K | Giữ: data models cần compatible với Rust |
| `storage/storage.py` | 26K | Giữ: AI layer cần đọc/ghi scripts |
| `ipc/handler.py` | 45K | **Refactor lớn**: bỏ commands recorder/player, thêm AI commands |

#### Thêm mới:
| File | Mô tả |
|------|--------|
| `ai/agent.py` | LangGraph agent graph chính |
| `ai/tools.py` | Tool definitions cho deepagents (gọi Rust, playwright-mcp) |
| `ai/memory.py` | mem0 integration cho context memory |
| `ai/test_generator.py` | Test case generation từ recording |
| `ai/recording_analyzer.py` | Phân tích recording JSON → hiểu user intent |
| `mcp/client.py` | MCP client để gọi playwright-mcp |
| `mcp/browser_tools.py` | Browser-specific tools (navigate, click, type, assert) |

### 3.2. Rust — GIỮ automation, BỎ AI generation

#### Giữ nguyên (core automation):
| Module | Lý do |
|--------|-------|
| `application_focused_automation/*` | Đây là thế mạnh: focus monitoring, playback, platform-specific |
| `main.rs` (command handlers) | Tauri entry point, cần giữ |
| `python_process.rs` | IPC bridge, cần refactor nhẹ |

#### Refactor:
| File | Thay đổi |
|------|---------|
| `core_router.rs` (96K) | **Đơn giản hóa lớn**: bỏ dual-core logic, Rust là core duy nhất cho automation |
| `main.rs` | Thêm commands cho AI layer (gọi qua Python IPC) |
| `python_process.rs` | Mở rộng: support AI commands, async event streaming |

#### Xóa hoặc chuyển:
| Module | Lý do |
|--------|-------|
| `ai_test_case/` (service.rs 93K, monitoring.rs 64K, ...) | Chuyển logic sang Python deepagents — AI nên nằm ở Python ecosystem |

### 3.3. TypeScript — GIỮ UI, THÊM AI dashboard

#### Giữ nguyên:
- Tất cả UI components hiện tại
- `scriptStorageService.ts`, `tauriService.ts`
- Step management utils (splitting, merging, reordering)

#### Thêm mới:
| Component | Mô tả |
|-----------|--------|
| `AIAgentDashboard` | Hiển thị trạng thái AI agent, test results |
| `BrowserAutomationPanel` | UI cho browser automation (Option A/B selection) |
| `TestCaseViewer` | Xem test cases AI sinh ra, approve/edit/reject |
| `RecordingAnalysis` | Hiển thị AI phân tích recording |

#### Đơn giản hóa:
| Component | Thay đổi |
|-----------|---------|
| `CoreSelector` | **Xóa** — không cần chọn Python/Rust nữa, mỗi ngôn ngữ 1 vai trò |

### 3.4. IPC Protocol — Refactor

#### Commands hiện tại → phân lại:

**Rust xử lý trực tiếp (không qua Python):**
```
start_recording()        → Rust recorder
stop_recording()         → Rust recorder
start_playback()         → Rust player
stop_playback()          → Rust player
pause_playback()         → Rust player
```

**Python xử lý (AI layer):**
```
analyze_recording()      → [MỚI] AI phân tích recording
generate_test_cases()    → [MỚI] AI sinh test cases
execute_ai_test()        → [MỚI] AI orchestrate test execution
get_ai_context()         → [MỚI] Lấy context từ mem0
ai_vision_capture()      → [GIỮ] Gemini element detection
```

**Commands giữ ở Python (storage):**
```
list_scripts()           → Python storage
load_script()            → Python storage  
save_script()            → Python storage
delete_script()          → Python storage
```

## 4. Migration Strategy

### 4.1. Bước 1: Tách rõ ranh giới (không breaking changes)

1. Đánh dấu Python `recorder.py` và `player.py` là **deprecated**
2. Đảm bảo Rust recorder/player xử lý đầy đủ tất cả action types
3. Core router mặc định chọn Rust, Python chỉ là fallback

### 4.2. Bước 2: Chuyển AI từ Rust sang Python

1. Export logic từ `ai_test_case/service.rs` thành spec
2. Implement lại trong Python với deepagents framework
3. Rust `ai_test_case/` module gọi Python thay vì tự làm

### 4.3. Bước 3: Xóa code thừa

1. Xóa `recorder/recorder.py`, `player/player.py`
2. Đơn giản hóa `core_router.rs` — bỏ dual-core logic
3. Xóa `CoreSelector` component
4. Cập nhật tests

### 4.4. Bước 4: Thêm AI layer mới

1. Thêm deepagents vào Python
2. Thêm AI commands vào IPC protocol
3. Thêm AI dashboard vào UI

## 5. Rủi ro và giảm thiểu

| Rủi ro | Mức độ | Giảm thiểu |
|--------|--------|-----------|
| Rust recorder thiếu feature so với Python | Trung bình | Audit feature parity trước khi xóa Python |
| IPC protocol thay đổi gây breaking | Cao | Versioned protocol, backward compatible |
| AI layer chưa ổn định khi chuyển từ Rust | Trung bình | Giữ Rust AI code làm reference, test song song |
| Mất test coverage khi xóa Python tests | Trung bình | Port Python tests sang Rust trước khi xóa |

## 6. Tiêu chí hoàn thành Phase 1

- [ ] Rust là core automation duy nhất (recorder + player)
- [ ] Python chỉ chứa: AI vision, storage/models, IPC handler (refactored), AI agent (mới)
- [ ] `core_router.rs` đơn giản hóa, không còn dual-core fallback
- [ ] `CoreSelector` component đã xóa
- [ ] IPC protocol v2 với commands phân lại rõ ràng
- [ ] Tất cả existing tests pass (hoặc được port)
- [ ] Không có regression trong record/playback flow
