#!/usr/bin/env python3
"""
Self-running macOS automation demo — end-to-end loop.

Exercises the full GeniusQA automation pipeline with REAL components:

    1. Capture a screenshot (real screen, or a synthetic rendered UI in SAFE mode)
    2. Scan text / OCR locally (Tesseract, 0 token) to locate a target label
    3. Write an automation script targeting the located coordinates
    4. Execute the script (dry-run by default; real pyautogui only with --live)
    5. Demonstrate the LLM-coordinate-analysis fallback path (mocked unless a
       GEMINI_API_KEY is provided)
    6. Print token accounting (local_ocr_hits vs llm_calls)

By default this is SAFE and self-contained: it renders a synthetic screenshot
with a known "Submit" label so the loop is deterministic and never moves the
real cursor. Pass --real-screen to OCR the actual screen, and --live to actually
drive pyautogui (use with care).

Usage:
    python3 examples/self_running_macos_demo.py
    python3 examples/self_running_macos_demo.py --real-screen
    python3 examples/self_running_macos_demo.py --live          # moves the mouse!

Exit code 0 means the loop completed and the target was located.
"""

import argparse
import asyncio
import base64
import io
import json
import os
import sys
import tempfile
from pathlib import Path

# Make `src` importable when run from the package root.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw  # noqa: E402

from src.vision.local_ocr_service import LocalOCRService  # noqa: E402
from src.vision.ai_vision_service import (  # noqa: E402
    AIVisionService,
    AIVisionRequest,
    AIVisionResponse,
)


TARGET_LABEL = "Submit"


def log(step: str, msg: str) -> None:
    print(f"[{step}] {msg}")


# ---------------------------------------------------------------------------
# Step 1 — Screenshot capture
# ---------------------------------------------------------------------------

def render_synthetic_screenshot() -> str:
    """Render a deterministic UI containing a 'Submit' button; return base64 PNG."""
    img = Image.new("RGB", (640, 360), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, 200, 90], outline="black", width=2)
    d.text((70, 58), "Cancel", fill="black")
    d.rectangle([260, 200, 420, 250], outline="black", width=2)
    d.text((300, 218), TARGET_LABEL, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


class ScreenCaptureError(Exception):
    """Raised when the real screen cannot be captured (e.g. missing permission)."""


def capture_real_screenshot() -> str:
    """
    Capture the real screen via pyautogui; return base64 PNG.

    On macOS this requires the Screen Recording permission for the running
    process. If capture fails (permission missing, headless, etc.) we raise
    ScreenCaptureError so the caller can degrade gracefully rather than crash.
    """
    try:
        import pyautogui  # imported lazily so SAFE mode needs no screen access
        shot = pyautogui.screenshot()
        if shot is None:
            raise ScreenCaptureError("screenshot() returned None")
        buf = io.BytesIO()
        shot.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()
    except ScreenCaptureError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface a clear, actionable error
        raise ScreenCaptureError(str(exc)) from exc


# ---------------------------------------------------------------------------
# Step 3 — Write an automation script
# ---------------------------------------------------------------------------

def build_script(x: int, y: int, target: str) -> dict:
    """Build a minimal click-at-coordinate automation script (GeniusQA format)."""
    return {
        "version": "1.0",
        "metadata": {
            "duration": 0,
            "action_count": 2,
            "core_type": "python",
            "platform": "macos",
            "additional_data": {
                "source": "self_running_demo",
                "target_label": target,
            },
        },
        "actions": [
            {"type": "mouse_move", "timestamp": 0, "x": x, "y": y},
            {"type": "mouse_click", "timestamp": 100, "x": x, "y": y, "button": "left"},
        ],
    }


# ---------------------------------------------------------------------------
# Step 4 — Execute the script
# ---------------------------------------------------------------------------

def execute_script(script: dict, live: bool) -> None:
    """Execute actions. Dry-run logs each action; --live drives pyautogui."""
    for i, action in enumerate(script["actions"]):
        atype = action["type"]
        if live:
            import pyautogui
            if atype == "mouse_move":
                pyautogui.moveTo(action["x"], action["y"], _pause=False)
            elif atype == "mouse_click":
                pyautogui.click(action["x"], action["y"],
                                button=action.get("button", "left"), _pause=False)
            log("EXEC", f"action {i}: {atype} -> LIVE at ({action.get('x')},{action.get('y')})")
        else:
            log("EXEC", f"action {i}: {atype} -> DRY-RUN at ({action.get('x')},{action.get('y')})")


# ---------------------------------------------------------------------------
# Step 5 — LLM-coordinate-analysis fallback demonstration
# ---------------------------------------------------------------------------

async def demo_llm_fallback(screenshot_b64: str) -> AIVisionResponse:
    """
    Show the LLM fallback path for a NON-text / visual prompt where local OCR
    cannot help. If GEMINI_API_KEY is set we make a real call; otherwise we
    inject a mock LLM so the loop is fully self-contained.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    svc = AIVisionService()
    await svc.initialize(api_key or "demo-key")

    if not api_key:
        async def mock_llm(*args, **kwargs):
            return AIVisionResponse(success=True, x=330, y=225, confidence=0.83)
        svc._call_gemini_vision_api = mock_llm  # type: ignore[assignment]

    # A visual prompt with no quoted text target -> OCR is skipped -> LLM runs.
    req = AIVisionRequest(screenshot=screenshot_b64,
                          prompt="the highlighted primary action button")
    resp = await svc.analyze(req)
    log("LLM", f"fallback analyze -> success={resp.success} "
                f"coords=({resp.x},{resp.y}) conf={resp.confidence} "
                f"(local_ocr_hits={svc.local_ocr_hits}, llm_calls={svc.llm_calls})")
    return resp


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

async def main() -> int:
    parser = argparse.ArgumentParser(description="Self-running macOS automation demo")
    parser.add_argument("--real-screen", action="store_true",
                        help="OCR the actual screen instead of a synthetic image")
    parser.add_argument("--live", action="store_true",
                        help="Actually drive pyautogui (moves the real mouse!)")
    args = parser.parse_args()

    ocr = LocalOCRService()
    log("ENV", f"local OCR available: {ocr.is_available()}")

    # Step 1: screenshot
    if args.real_screen:
        try:
            screenshot = capture_real_screenshot()
            log("CAPTURE", "captured real screen")
        except ScreenCaptureError as exc:
            log("CAPTURE", f"real screen capture failed ({exc}).")
            log("PERMISSION", "Grant Screen Recording permission to this process: "
                             "System Settings > Privacy & Security > Screen Recording. "
                             "Falling back to synthetic UI so the loop still completes.")
            screenshot = render_synthetic_screenshot()
    else:
        screenshot = render_synthetic_screenshot()
        log("CAPTURE", "rendered synthetic UI with a 'Submit' button")

    # Step 2: scan text / OCR (0 token)
    if not ocr.is_available():
        log("OCR", "Tesseract unavailable — would defer to LLM for all targets")
        # Still demonstrate the LLM fallback so the loop completes.
        await demo_llm_fallback(screenshot)
        log("DONE", "completed via LLM-only path (no local OCR engine)")
        return 0

    boxes = ocr.extract_text_boxes(screenshot)
    log("OCR", f"scanned {len(boxes)} text box(es): "
               f"{[b.text for b in boxes][:10]}")

    result = ocr.locate_text(screenshot, TARGET_LABEL)
    if not result.success:
        log("OCR", f"could not locate '{TARGET_LABEL}' locally; falling back to LLM")
        resp = await demo_llm_fallback(screenshot)
        if not resp.success:
            log("DONE", "FAILED: target not found by OCR or LLM")
            return 1
        x, y = resp.x, resp.y
    else:
        x, y = result.x, result.y
        log("OCR", f"located '{TARGET_LABEL}' at ({x},{y}) "
                   f"conf={result.confidence} — 0 TOKEN COST")

    # Step 3: write script
    script = build_script(x, y, TARGET_LABEL)
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(script, f, indent=2)
        script_path = f.name
    log("SCRIPT", f"wrote automation script -> {script_path}")

    # Step 4: execute
    execute_script(script, live=args.live)

    # Step 5: LLM fallback demonstration (separate visual target)
    await demo_llm_fallback(screenshot)

    log("DONE", "self-running automation loop completed successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
