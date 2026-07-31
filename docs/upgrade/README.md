# GeniusQA Upgrade Strategy — Tổng quan

> Tài liệu này là bản đồ toàn diện cho việc nâng cấp GeniusQA từ automation tool thành **AI-powered test automation platform**.

## 📋 Danh sách tài liệu

| # | Tài liệu | Mô tả |
|---|----------|--------|
| 01 | [ARCHITECTURE-REFACTOR.md](./01-ARCHITECTURE-REFACTOR.md) | Tái cấu trúc kiến trúc — phân định vai trò Python / Rust / TypeScript |
| 02 | [DEEPAGENTS-AI-INTEGRATION.md](./02-DEEPAGENTS-AI-INTEGRATION.md) | Tích hợp sâu AI với `langchain-ai/deepagents` & LangGraph |
| 03 | [EXECUTION-ENGINE.md](./03-EXECUTION-ENGINE.md) | Kiến trúc Recording → AI Engine → Execution Engine, browser automation (Option A + B) |
| 04 | [REQUIREMENTS.md](./04-REQUIREMENTS.md) | Yêu cầu chi tiết cho từng phase |
| 05 | [TASKS.md](./05-TASKS.md) | Phân chia task, dependencies, và thứ tự ưu tiên |

## 🎯 Mục tiêu tổng thể

```
Screen Recording → AI Analysis → Test Case Generation → Automation Execution
      ↑                                                         ↓
   mem0 (context)  ←←←←←←←←←←←←←←←← Feedback loop ←←←←←←←←←
```

### Trước upgrade
- Record/play chạy bằng hard-coded coordinates (x, y)
- AI chỉ dùng Gemini tìm tọa độ pixel (1 file duy nhất)
- Python và Rust trùng lặp chức năng (cả hai đều có recorder + player)
- Không có AI agent, không có context memory

### Sau upgrade
- AI agent (deepagents) điều phối toàn bộ luồng test
- Rust = automation engine (OS-level, hiệu suất cao)
- Python = AI brain (deepagents, Gemini, mem0)
- Browser automation qua 2 option: CDP protocol (không chiếm chuột) + OS-level input (chiếm chuột)
- Context memory xuyên phiên làm việc

## 🏗️ Kiến trúc mục tiêu

```
┌─────────────────────────────────────────────────────────────┐
│                    GeniusQA Desktop (Tauri)                  │
│              TypeScript / React — UI/UX layer                │
└──────────────────────┬──────────────────────────────────────┘
                       │ Tauri IPC
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌─────────────────┐       ┌──────────────────────────┐
│   Rust Core     │       │   Python AI Layer         │
│  (automation)   │       │   (deepagents + tools)    │
│                 │◄──────│                           │
│ • record input  │ IPC   │ • LangGraph agent graph   │
│ • playback      │       │ • test case generation    │
│ • OS-level sim  │       │ • playwright-mcp client   │
│ • screenshot    │       │ • mem0 context memory     │
│ • visual diff   │       │ • Gemini vision analysis  │
│ • monitoring    │       │ • recording analysis      │
└─────────────────┘       └──────────────────────────┘
```

## 📊 Phân tích hiện trạng (từ codebase)

### Rust Core (đã trưởng thành)
- `player.rs` + `playback_controller.rs`: ~223KB — playback engine hoàn chỉnh
- `application_focused_automation/`: monitoring, focus tracking, fallback, notification
- Platform-specific: macOS (66K), Windows (14K)
- Property-based tests: 181K
- Dependencies: `rdev`, `core-graphics`, `winapi`, `x11` — OS-level control

### Python Core (cần refactor)
- `recorder.py` (27K) + `player.py` (72K) — **trùng lặp** với Rust
- `ai_vision_service.py` (17K) — **cần giữ và mở rộng** (AI layer)
- `ipc/handler.py` (45K) — IPC gateway, cần refactor
- `storage/models.py` (32K) — data models, cần giữ

### Trùng lặp cần xử lý
| Chức năng | Rust | Python | Quyết định |
|-----------|------|--------|-----------|
| Recorder | ✅ Có (rdev, OS-level) | ✅ Có (pynput) | **Giữ Rust**, xóa Python recorder |
| Player | ✅ Có (playback_controller) | ✅ Có (pyautogui) | **Giữ Rust**, xóa Python player |
| AI Vision | ✅ Có (ai_vision_integration) | ✅ Có (ai_vision_service) | **Giữ Python**, Rust delegate sang Python |
| Storage/Models | ✅ Có (types.rs) | ✅ Có (models.py) | **Giữ cả hai**, đảm bảo compatible |

## 🔗 Các repo bên ngoài sẽ tích hợp

| Repo | Stars | Vai trò |
|------|-------|---------|
| [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | ⭐ 21k+ | AI agent framework — "não" của GeniusQA |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | ⭐ 31k+ | Browser automation qua MCP protocol (Option A) |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | ⭐ 53k+ | Context memory xuyên phiên làm việc |
| [browserbase/stagehand](https://github.com/browserbase/stagehand) | ⭐ 22k+ | TypeScript browser agent SDK |
| [Skyvern-AI/skyvern](https://github.com/Skyvern-AI/skyvern) | ⭐ 21k+ | Computer vision + real mouse browser automation (Option B) |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | ⭐ 10k+ | Graph-based AI agent orchestration |

## ⏱️ Phases tổng quan

| Phase | Nội dung | Tài liệu |
|-------|----------|----------|
| **Phase 1** | Refactor kiến trúc — phân tách Python/Rust | [01-ARCHITECTURE-REFACTOR.md](./01-ARCHITECTURE-REFACTOR.md) |
| **Phase 2** | Tích hợp deepagents + mem0 | [02-DEEPAGENTS-AI-INTEGRATION.md](./02-DEEPAGENTS-AI-INTEGRATION.md) |
| **Phase 3** | Triển khai execution engine (browser + OS) | [03-EXECUTION-ENGINE.md](./03-EXECUTION-ENGINE.md) |
