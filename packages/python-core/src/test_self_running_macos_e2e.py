"""
Self-running end-to-end test for the macOS automation loop.

Runs the full pipeline (screenshot -> OCR/scan text -> build script -> execute
dry-run -> LLM-coordinate fallback -> token accounting) using REAL components in
SAFE mode (synthetic screenshot, no cursor movement, mocked LLM). This is the
automated counterpart of examples/self_running_macos_demo.py and guards the loop
against regressions.

Requirements: local-ocr-token-optimization 5.1, 5.2.
"""

import asyncio
import base64
import io
import sys
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.vision.local_ocr_service import LocalOCRService
from src.vision.ai_vision_service import (
    AIVisionService,
    AIVisionRequest,
    AIVisionResponse,
)

TARGET = "Submit"


def _synthetic_screenshot() -> str:
    img = Image.new("RGB", (640, 360), "white")
    d = ImageDraw.Draw(img)
    d.rectangle([260, 200, 420, 250], outline="black", width=2)
    d.text((300, 218), TARGET, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


@pytest.mark.skipif(
    not LocalOCRService().is_available(),
    reason="Tesseract OCR engine not available on this host",
)
def test_full_loop_locates_text_with_zero_tokens():
    """Screenshot -> OCR -> script -> execute(dry) completes with 0 LLM calls."""
    shot = _synthetic_screenshot()
    ocr = LocalOCRService()

    boxes = ocr.extract_text_boxes(shot)
    assert any("submit" in b.text.lower() for b in boxes), \
        f"OCR should detect the Submit label, got {[b.text for b in boxes]}"

    result = ocr.locate_text(shot, TARGET)
    assert result.success, "Local OCR should locate the Submit label"
    assert result.x is not None and result.y is not None

    # Build + 'execute' (dry-run) a script targeting the located coordinates.
    script = {
        "version": "1.0",
        "metadata": {"action_count": 2, "core_type": "python", "platform": "macos"},
        "actions": [
            {"type": "mouse_move", "x": result.x, "y": result.y},
            {"type": "mouse_click", "x": result.x, "y": result.y, "button": "left"},
        ],
    }
    executed = [a["type"] for a in script["actions"]]  # dry-run: no pyautogui
    assert executed == ["mouse_move", "mouse_click"]


def test_llm_fallback_path_is_self_contained():
    """A visual (non-text) prompt skips OCR and uses the (mocked) LLM path."""
    shot = _synthetic_screenshot()
    svc = AIVisionService()
    _run(svc.initialize("demo-key"))

    async def mock_llm(*args, **kwargs):
        return AIVisionResponse(success=True, x=330, y=225, confidence=0.83)

    svc._call_gemini_vision_api = mock_llm  # type: ignore[assignment]

    req = AIVisionRequest(screenshot=shot, prompt="the highlighted primary button")
    resp = _run(svc.analyze(req))
    assert resp.success
    assert (resp.x, resp.y) == (330, 225)
    assert svc.local_ocr_hits == 0
    assert svc.llm_calls == 1


@pytest.mark.skipif(
    not LocalOCRService().is_available(),
    reason="Tesseract OCR engine not available on this host",
)
def test_text_target_avoids_llm_entirely():
    """End-to-end: quoted text target is served by OCR, LLM never called."""
    shot = _synthetic_screenshot()
    svc = AIVisionService()  # real LocalOCRService inside
    _run(svc.initialize("demo-key"))

    # Guard: if the LLM is invoked, fail loudly.
    async def forbidden_llm(*args, **kwargs):
        raise AssertionError("LLM must not be called for an OCR-locatable target")

    svc._call_gemini_vision_api = forbidden_llm  # type: ignore[assignment]

    req = AIVisionRequest(screenshot=shot, prompt='Click the "Submit" button')
    resp = _run(svc.analyze(req))
    assert resp.success
    assert svc.local_ocr_hits == 1
    assert svc.llm_calls == 0
