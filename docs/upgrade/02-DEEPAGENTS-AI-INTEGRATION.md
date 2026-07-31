# Phase 2: Tích hợp sâu AI với deepagents & LangGraph

## 1. Tổng quan

### 1.1. Tại sao deepagents?

[langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) (⭐ 21k+) là framework agent "batteries-included" từ LangChain:

| Tính năng | Mô tả | Áp dụng cho GeniusQA |
|-----------|--------|----------------------|
| `write_todos` | Planning, breakdown task | AI tự chia nhỏ "test login flow" → nhiều test cases |
| `task` | Spawn sub-agents với context window riêng | Chạy song song nhiều test cases |
| `execute` | Gọi shell command | Gọi Rust binary trực tiếp |
| `read/write_file` | Đọc ghi file | Đọc recording JSON, ghi test result |
| MCP adapter | `langchain-mcp-adapters` | Gọi playwright-mcp cho browser automation |
| Context management | Auto-summarize khi context dài | Không bị mất context giữa nhiều test cases |

### 1.2. AI hiện tại vs AI mục tiêu

```
HIỆN TẠI:
  Recording → hard-coded (x,y) → Playback
                    ↑
  AI chỉ được gọi khi user chọn "ai_vision_capture" action
  → Gemini tìm tọa độ pixel → click tại tọa độ

MỤC TIÊU:
  Recording → AI phân tích intent → Sinh test cases → AI orchestrate execution
       ↑                                                        ↓
    mem0 (nhớ context) ←←←←←←←← Feedback loop (PASS/FAIL) ←←←
```

## 2. Kiến trúc AI Layer

### 2.1. LangGraph Agent Graph

```
                    ┌─────────────────────────────────────┐
                    │      LangGraph Agent Graph           │
                    │                                      │
  Recording JSON ──►│  ┌─────────────────────────────┐    │
  (from Rust)       │  │ Node 1: ANALYZE              │    │
                    │  │ Phân tích recording → intent  │    │
                    │  │ "User đang test login flow"   │    │
                    │  └──────────────┬────────────────┘    │
                    │                 ↓                     │
                    │  ┌─────────────────────────────┐     │
                    │  │ Node 2: PLAN                  │    │
                    │  │ deepagents write_todos         │    │
                    │  │ → Happy path test              │    │
                    │  │ → Wrong password test          │    │
                    │  │ → Empty field test             │    │
                    │  │ → SQL injection test           │    │
                    │  └──────────────┬────────────────┘    │
                    │                 ↓                     │
                    │  ┌─────────────────────────────┐     │
                    │  │ Node 3: GENERATE              │    │
                    │  │ Sinh test case actions         │    │
                    │  │ → TestStep + Action objects    │    │
                    │  └──────────────┬────────────────┘    │
                    │                 ↓                     │
                    │  ┌─────────────────────────────┐     │
                    │  │ Node 4: EXECUTE               │    │
                    │  │ Gọi Rust core hoặc            │    │
                    │  │ playwright-mcp                 │    │
                    │  └──────────────┬────────────────┘    │
                    │            ↙ PASS    ↘ FAIL           │
                    │  ┌──────────┐  ┌───────────────┐     │
                    │  │ Node 5a  │  │ Node 5b       │     │
                    │  │ REPORT   │  │ DEBUG & RETRY  │     │
                    │  │ Lưu kết  │  │ AI phân tích   │     │
                    │  │ quả +    │  │ lỗi → retry    │     │
                    │  │ mem0     │  │ (max 3 lần)    │     │
                    │  └──────────┘  └───────┬────────┘     │
                    │                        ↓ loop back     │
                    │                    Node 4 (EXECUTE)    │
                    └─────────────────────────────────────┘
```

### 2.2. State Schema

```python
class GeniusQAAgentState(TypedDict):
    # Input
    recording: dict              # Raw recording JSON từ Rust
    user_intent: str             # Mô tả từ user (optional)
    
    # Analysis
    analyzed_actions: list       # Parsed actions với semantic labels
    detected_flow: str           # "login", "checkout", "form_submission"
    
    # Planning
    test_plan: list              # List of test case descriptions
    
    # Generation  
    test_cases: list[TestCase]   # Generated test cases
    current_test_index: int      # Which test case is running
    
    # Execution
    execution_mode: str          # "browser_cdp" | "os_level" | "hybrid"
    execution_results: list      # PASS/FAIL per test case
    
    # Debug
    retry_count: int             # Current retry for failed test
    error_analysis: str          # AI analysis of failure
    
    # Memory
    session_context: dict        # mem0 context from previous sessions
```

### 2.3. Tool Registry

deepagents gọi tools thông qua registry. GeniusQA cần register các tools sau:

```python
TOOLS = {
    # === Rust Core Tools (gọi qua shell/IPC) ===
    "rust_start_recording": {
        "description": "Start recording user actions on OS level",
        "execute": "ipc_call('start_recording')"
    },
    "rust_stop_recording": {
        "description": "Stop recording and return JSON",
        "execute": "ipc_call('stop_recording')"  
    },
    "rust_playback": {
        "description": "Execute actions via Rust OS-level automation",
        "params": ["actions: list", "speed: float"],
        "execute": "ipc_call('start_playback', actions, speed)"
    },
    "rust_screenshot": {
        "description": "Take screenshot of current screen",
        "execute": "ipc_call('screenshot')"
    },
    
    # === Browser Tools (qua playwright-mcp) ===
    "browser_navigate": {
        "description": "Navigate browser to URL",
        "params": ["url: str"],
        "execute": "mcp_call('browser_navigate', url)"
    },
    "browser_click": {
        "description": "Click element in browser by selector or description",
        "params": ["selector: str"],
        "execute": "mcp_call('browser_click', selector)"
    },
    "browser_type": {
        "description": "Type text into element",
        "params": ["selector: str", "text: str"],
        "execute": "mcp_call('browser_type', selector, text)"
    },
    "browser_snapshot": {
        "description": "Get accessibility snapshot of current page",
        "execute": "mcp_call('browser_snapshot')"
    },
    "browser_assert": {
        "description": "Assert condition on page",
        "params": ["condition: str"],
        "execute": "mcp_call('browser_assert', condition)"
    },
    
    # === AI Vision Tools ===
    "vision_find_element": {
        "description": "Use Gemini to find UI element in screenshot",
        "params": ["prompt: str", "screenshot_path: str"],
        "execute": "ai_vision_service.find_element(prompt, screenshot_path)"
    },
    "vision_compare": {
        "description": "Compare two screenshots for visual regression",
        "params": ["baseline: str", "current: str"],
        "execute": "ai_vision_service.compare(baseline, current)"
    },
    
    # === Memory Tools ===
    "memory_recall": {
        "description": "Recall context from previous test sessions",
        "params": ["query: str"],
        "execute": "mem0.search(query)"
    },
    "memory_store": {
        "description": "Store important context for future sessions",
        "params": ["content: str", "metadata: dict"],
        "execute": "mem0.add(content, metadata)"
    }
}
```

## 3. Luồng chi tiết

### 3.1. Recording → AI Analysis

```
Input: Recording JSON từ Rust
{
  "actions": [
    {"type": "click", "x": 100, "y": 50, "screenshot": "shot_001.png"},
    {"type": "type", "text": "admin@test.com", "screenshot": "shot_002.png"},
    {"type": "click", "x": 200, "y": 100, "screenshot": "shot_003.png"},
    {"type": "type", "text": "password123", "screenshot": "shot_004.png"},
    {"type": "click", "x": 150, "y": 200, "screenshot": "shot_005.png"}
  ]
}

AI Analysis Output:
{
  "flow_type": "login",
  "semantic_actions": [
    {"intent": "click_email_field", "element": "email input", "selector_hint": "#email"},
    {"intent": "enter_email", "value": "admin@test.com", "field": "email"},
    {"intent": "click_password_field", "element": "password input", "selector_hint": "#password"},
    {"intent": "enter_password", "value": "password123", "field": "password"},
    {"intent": "click_submit", "element": "Login button", "selector_hint": "#submit-btn"}
  ],
  "detected_page": "Login Page",
  "detected_app": "Web Application"
}
```

### 3.2. AI → Test Case Generation

```
Từ analysis "login flow", AI sinh:

Test Case 1: Happy Path Login
  Steps:
    1. Navigate to login page
    2. Enter valid email
    3. Enter valid password
    4. Click Login
    5. Assert: redirected to dashboard

Test Case 2: Wrong Password
  Steps:
    1. Navigate to login page
    2. Enter valid email
    3. Enter WRONG password
    4. Click Login
    5. Assert: error message "Invalid credentials"

Test Case 3: Empty Fields
  Steps:
    1. Navigate to login page
    2. Leave email empty
    3. Leave password empty
    4. Click Login
    5. Assert: validation messages appear

Test Case 4: SQL Injection Attempt
  Steps:
    1. Navigate to login page
    2. Enter "' OR 1=1 --" as email
    3. Enter anything as password
    4. Click Login
    5. Assert: no unauthorized access
```

### 3.3. Test Case → Execution (chọn engine)

```
AI quyết định execution mode cho mỗi action:

Action: "Navigate to https://app.example.com"
  → Mode: browser_cdp (playwright-mcp)
  → Lý do: web navigation, không cần OS-level

Action: "Click Login button"  
  → Mode: browser_cdp (playwright-mcp)
  → Lý do: element có selector, CDP đủ

Action: "Upload file via native dialog"
  → Mode: os_level (Rust core)
  → Lý do: native file dialog nằm ngoài browser DOM

Action: "Compare current page with baseline"
  → Mode: hybrid
  → Lý do: screenshot (Rust) + visual compare (AI Vision)
```

## 4. mem0 Context Memory

### 4.1. Tại sao cần mem0?

[mem0ai/mem0](https://github.com/mem0ai/mem0) (⭐ 53k+) cung cấp "long-term memory" cho AI:

| Không có mem0 | Có mem0 |
|---------------|---------|
| AI quên hết sau mỗi session | AI nhớ bug patterns, test history |
| Mỗi lần chạy test, AI phải phân tích lại từ đầu | AI biết element nào hay thay đổi |
| Không học từ failures | AI biết test nào hay fail và tại sao |

### 4.2. Dữ liệu lưu vào mem0

```python
# Sau mỗi test run, lưu context:
mem0.add(
    content=f"Test '{test_name}' on {app_name}: {result}. "
            f"Failed at step '{failed_step}' because '{error_reason}'.",
    metadata={
        "type": "test_result",
        "app": "example.com",
        "flow": "login",
        "result": "FAIL",
        "error_type": "element_not_found",
        "selector": "#login-btn",
        "timestamp": "2026-04-18"
    }
)

# Trước test run mới, recall context:
context = mem0.search(
    query="login test failures on example.com",
    limit=5
)
# → "Last 3 runs: #login-btn changed to .btn-login after deploy on 2026-04-15"
# → AI tự điều chỉnh selector!
```

### 4.3. Loại context lưu trữ

| Loại | Ví dụ | Cách sử dụng |
|------|-------|-------------|
| **Test results** | "Login test PASS 2026-04-18" | Tracking reliability |
| **Bug patterns** | "#submit-btn biến mất khi screen < 768px" | AI tránh lỗi đã biết |
| **Element changes** | ".btn-primary thay đổi thành .btn-main" | Auto-fix selectors |
| **App knowledge** | "App X cần 3s load time sau login" | Adjust wait times |
| **User preferences** | "User thích test edge cases trước" | Personalized test plan |

## 5. Dependencies mới cho Python

### 5.1. Thêm vào `requirements.txt`

```
# === AI Agent Framework ===
deepagents>=0.1.0
langgraph>=0.2.0
langchain-core>=0.3.0
langchain-google-genai>=2.0.0    # Gemini integration (thay thế gọi API trực tiếp)

# === MCP Client ===
langchain-mcp-adapters>=0.1.0    # Gọi playwright-mcp từ LangGraph

# === Context Memory ===
mem0ai>=0.1.0

# === Utilities ===
pydantic>=2.5.0                  # Đã có
aiohttp>=3.9.0                   # Đã có
```

### 5.2. Bỏ khỏi `requirements.txt` (sau khi xóa Python automation)

```
# Không cần nữa khi Rust là automation core:
# pyautogui==0.9.53       → Rust rdev thay thế
# pynput==1.7.6           → Rust rdev thay thế
# keyboard==0.13.5        → Rust rdev thay thế
# mouse==0.7.1            → Rust rdev thay thế
```

## 6. File structure mới cho Python AI layer

```
packages/python-core/src/
├── __main__.py                    # Entry point (giữ)
├── ipc/
│   ├── handler.py                 # Refactored: bỏ recorder/player commands, thêm AI
│   └── __init__.py
├── ai/                            # [MỚI] — deepagents integration
│   ├── __init__.py
│   ├── agent.py                   # LangGraph agent graph definition
│   ├── state.py                   # Agent state schema
│   ├── nodes/                     # Graph nodes
│   │   ├── __init__.py
│   │   ├── analyze.py             # Node 1: Phân tích recording
│   │   ├── plan.py                # Node 2: Lập kế hoạch test
│   │   ├── generate.py            # Node 3: Sinh test cases
│   │   ├── execute.py             # Node 4: Thực thi test
│   │   └── debug.py               # Node 5: Debug failures
│   ├── tools/                     # Tool definitions cho agent
│   │   ├── __init__.py
│   │   ├── rust_tools.py          # Tools gọi Rust core
│   │   ├── browser_tools.py       # Tools gọi playwright-mcp
│   │   └── vision_tools.py        # Tools gọi AI Vision
│   └── memory/                    # mem0 integration
│       ├── __init__.py
│       └── context.py             # Context management
├── mcp/                           # [MỚI] — MCP client
│   ├── __init__.py
│   ├── client.py                  # MCP protocol client
│   └── playwright.py              # playwright-mcp specific tools
├── vision/                        # (giữ + mở rộng)
│   ├── ai_vision_service.py       # Gemini integration
│   ├── image_utils.py
│   ├── intent_analyzer.py         # [MỚI] Phân tích intent từ screenshots
│   └── __init__.py
├── storage/                       # (giữ nguyên)
│   ├── models.py
│   ├── storage.py
│   ├── asset_manager.py
│   ├── validation.py
│   └── __init__.py
├── recorder/                      # [DEPRECATED → XÓA sau Phase 1]
│   └── ...
└── player/                        # [DEPRECATED → XÓA sau Phase 1]
    └── ...
```

## 7. Cách deepagents gọi Rust Core

### 7.1. Qua IPC (stdin/stdout)

```python
# ai/tools/rust_tools.py

import json
import sys

class RustCoreTool:
    """Tool để deepagents gọi Rust automation core."""
    
    def _ipc_call(self, command: str, params: dict = None) -> dict:
        """Gửi command tới Rust qua stdout, nhận response từ stdin."""
        message = {
            "command": command,
            "params": params or {}
        }
        # Python AI process giao tiếp ngược với Rust
        # thông qua event system (stdout → Rust reads)
        print(json.dumps({"type": "rust_command", "data": message}))
        sys.stdout.flush()
        
        # Đợi response (Rust gửi qua stdin)
        response_line = sys.stdin.readline()
        return json.loads(response_line)
    
    def start_recording(self) -> dict:
        return self._ipc_call("start_recording")
    
    def playback(self, actions: list, speed: float = 1.0) -> dict:
        return self._ipc_call("start_playback", {
            "actions": actions,
            "speed": speed
        })
    
    def screenshot(self) -> str:
        result = self._ipc_call("screenshot")
        return result["data"]["path"]
```

### 7.2. Qua Shell Command (alternative)

```python
# Cho trường hợp cần gọi Rust binary trực tiếp
import subprocess

def execute_rust_command(command: str, args: dict) -> dict:
    result = subprocess.run(
        ["genius-qa-core", command, json.dumps(args)],
        capture_output=True,
        text=True,
        timeout=30
    )
    return json.loads(result.stdout)
```

## 8. Cách deepagents gọi playwright-mcp

### 8.1. Spawn MCP server

```python
# mcp/client.py

import subprocess
import asyncio

class PlaywrightMCPClient:
    """Client gọi playwright-mcp server."""
    
    def __init__(self):
        self.process = None
    
    async def start(self):
        """Spawn playwright-mcp server process."""
        self.process = subprocess.Popen(
            ["npx", "@playwright/mcp@latest"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
    
    async def call_tool(self, tool_name: str, arguments: dict) -> dict:
        """Gọi tool trên playwright-mcp."""
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        self.process.stdin.write(
            (json.dumps(request) + "\n").encode()
        )
        self.process.stdin.flush()
        
        response_line = self.process.stdout.readline()
        return json.loads(response_line)
```

### 8.2. Tích hợp với LangGraph qua MCP adapter

```python
# Cách đơn giản hơn: dùng langchain-mcp-adapters
from langchain_mcp_adapters import MCPToolkit

toolkit = MCPToolkit(
    server_command=["npx", "@playwright/mcp@latest"],
    transport="stdio"
)

# Tất cả playwright tools tự động available cho agent
tools = toolkit.get_tools()
# → [browser_navigate, browser_click, browser_type, browser_snapshot, ...]
```

## 9. Tiêu chí hoàn thành Phase 2

- [ ] `packages/python-core/src/ai/` module hoạt động với LangGraph agent graph
- [ ] deepagents tools registry hoàn chỉnh (Rust tools, browser tools, vision tools)
- [ ] mem0 integration lưu/recall context giữa sessions
- [ ] Agent phân tích được recording JSON → sinh ≥3 test cases
- [ ] Agent execute được test case qua playwright-mcp (browser) hoặc Rust (OS-level)
- [ ] Agent retry khi test fail (max 3 lần) với AI debug
- [ ] IPC protocol v2 hỗ trợ AI commands
- [ ] Unit tests cho tất cả nodes trong agent graph
- [ ] Integration test: record login → AI sinh test cases → execute → report
