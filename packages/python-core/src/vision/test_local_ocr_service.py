"""
Tests for the Local OCR Service (token-saving text fallback).

These tests do NOT require the Tesseract binary to be installed: the pure
matching/normalization helpers are tested directly, and engine-dependent paths
are tested by injecting a fake OCR engine / mocking pytesseract.

Requirements: token optimization for ai-vision-capture (local text fallback).
"""

import asyncio
import sys
from unittest.mock import MagicMock, patch

import pytest

from .local_ocr_service import (
    LocalOCRService,
    LocalOCRResult,
    OCRMatch,
    normalize_text,
    text_match_score,
)
from .ai_vision_service import (
    AIVisionService,
    AIVisionRequest,
    AIVisionResponse,
)

# NOTE: the vision package __init__ re-exports the `ai_vision_service` SINGLETON
# under that name, which shadows the submodule. To patch module-level globals
# (encode_image_base64, crop_to_roi) we must reach the real module object via
# the class's __module__ entry in sys.modules.
ai_vision_mod = sys.modules[AIVisionService.__module__]
local_ocr_mod = sys.modules[LocalOCRService.__module__]


# ============================================================================
# Pure helpers (engine-independent)
# ============================================================================

class TestNormalizeText:
    def test_lowercases_and_trims(self):
        assert normalize_text("  Submit  ") == "submit"

    def test_collapses_internal_whitespace(self):
        assert normalize_text("Log\t In") == "log in"

    def test_strips_surrounding_punctuation(self):
        assert normalize_text("Submit:") == "submit"
        assert normalize_text('"Login"') == "login"

    def test_empty(self):
        assert normalize_text("") == ""
        assert normalize_text(None) == ""  # type: ignore[arg-type]


class TestTextMatchScore:
    def test_exact_match_is_one(self):
        assert text_match_score("Submit", "submit") == 1.0

    def test_exact_match_ignoring_punctuation(self):
        assert text_match_score("Submit", "Submit:") == 1.0

    def test_whole_word_containment(self):
        # "OK" appears as a standalone word
        assert text_match_score("OK", "Click OK now") == 0.9

    def test_substring_containment_for_long_queries(self):
        # "user" is a substring of "username" but not a standalone word -> 0.75
        assert text_match_score("user", "username") == pytest.approx(0.75)

    def test_whole_word_beats_substring(self):
        # When the query appears as a whole word, that's the stronger 0.9 tier
        assert text_match_score("Login", "Login Form") == 0.9

    def test_no_match(self):
        assert text_match_score("Submit", "Cancel") == 0.0

    def test_empty_inputs(self):
        assert text_match_score("", "anything") == 0.0
        assert text_match_score("anything", "") == 0.0


class TestExtractQueryFromPrompt:
    def test_double_quotes(self):
        assert LocalOCRService.extract_query_from_prompt('Find the "Submit" button') == "Submit"

    def test_single_quotes(self):
        assert LocalOCRService.extract_query_from_prompt("Click the 'Login' link") == "Login"

    def test_smart_quotes(self):
        assert LocalOCRService.extract_query_from_prompt("Tap the “Đăng nhập” button") == "Đăng nhập"

    def test_no_quotes_returns_none(self):
        # No concrete text target -> defer to LLM
        assert LocalOCRService.extract_query_from_prompt("the blue button at top right") is None

    def test_empty(self):
        assert LocalOCRService.extract_query_from_prompt("") is None


# ============================================================================
# Graceful degradation when engine unavailable
# ============================================================================

class TestAvailability:
    def test_unavailable_when_pytesseract_missing(self):
        with patch.object(local_ocr_mod, "_pytesseract", None):
            svc = LocalOCRService()
            assert svc.is_available() is False
            # locate_text must not raise; returns a clean failure
            result = svc.locate_text("fake_base64", "Submit")
            assert result.success is False
            assert "not available" in (result.error or "").lower()

    def test_unavailable_when_binary_missing(self):
        fake = MagicMock()
        fake.get_tesseract_version.side_effect = Exception("tesseract not found")
        with patch.object(local_ocr_mod, "_pytesseract", fake):
            svc = LocalOCRService()
            assert svc.is_available() is False

    def test_extract_text_boxes_returns_empty_when_unavailable(self):
        with patch.object(local_ocr_mod, "_pytesseract", None):
            svc = LocalOCRService()
            assert svc.extract_text_boxes("fake_base64") == []


# ============================================================================
# locate_text with a fake engine (no real Tesseract)
# ============================================================================

def _make_service_with_boxes(boxes):
    """Build a LocalOCRService whose engine is faked to return `boxes`."""
    svc = LocalOCRService()
    svc.is_available = MagicMock(return_value=True)  # type: ignore[method-assign]
    svc.extract_text_boxes = MagicMock(return_value=boxes)  # type: ignore[method-assign]
    return svc


class TestLocateText:
    def test_confident_exact_hit(self):
        boxes = [
            OCRMatch(text="Submit", x=100, y=50, confidence=0.95,
                     left=80, top=40, width=40, height=20),
            OCRMatch(text="Cancel", x=200, y=50, confidence=0.95,
                     left=180, top=40, width=40, height=20),
        ]
        svc = _make_service_with_boxes(boxes)
        result = svc.locate_text("img", "Submit")
        assert result.success is True
        assert (result.x, result.y) == (100, 50)
        assert result.matched_text == "Submit"
        assert result.confidence is not None and result.confidence >= 0.9

    def test_low_ocr_confidence_defers_to_llm(self):
        # Exact text but the OCR engine is unsure -> combined below threshold
        boxes = [
            OCRMatch(text="Submit", x=100, y=50, confidence=0.2,
                     left=80, top=40, width=40, height=20),
        ]
        svc = _make_service_with_boxes(boxes)
        result = svc.locate_text("img", "Submit")
        assert result.success is False

    def test_no_text_match_defers(self):
        boxes = [
            OCRMatch(text="Cancel", x=200, y=50, confidence=0.99,
                     left=180, top=40, width=40, height=20),
        ]
        svc = _make_service_with_boxes(boxes)
        result = svc.locate_text("img", "Submit")
        assert result.success is False

    def test_picks_highest_combined_confidence(self):
        boxes = [
            OCRMatch(text="Login", x=10, y=10, confidence=0.6,
                     left=0, top=0, width=20, height=20),
            OCRMatch(text="Login", x=300, y=300, confidence=0.99,
                     left=290, top=290, width=20, height=20),
        ]
        svc = _make_service_with_boxes(boxes)
        result = svc.locate_text("img", "Login")
        assert result.success is True
        assert (result.x, result.y) == (300, 300)

    def test_empty_query(self):
        svc = _make_service_with_boxes([])
        result = svc.locate_text("img", "  ")
        assert result.success is False


# ============================================================================
# AIVisionService integration: local OCR avoids the LLM (token savings)
# ============================================================================

def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class TestAIVisionServiceLocalOCRIntegration:
    def _service_with_local_hit(self, x=120, y=60):
        """AIVisionService whose injected local OCR always returns a hit."""
        local = MagicMock(spec=LocalOCRService)
        local.is_available.return_value = True
        # extract_query_from_prompt is a staticmethod on the class; patch on class
        local.locate_text.return_value = LocalOCRResult(
            success=True, x=x, y=y, confidence=0.92, matched_text="Submit"
        )
        svc = AIVisionService(local_ocr=local)
        return svc, local

    @patch.object(ai_vision_mod, "encode_image_base64", side_effect=lambda s: s)
    def test_local_hit_skips_llm(self, _enc):
        svc, local = self._service_with_local_hit()
        _run(svc.initialize("fake-key"))
        # Guard: the LLM call must never run on a local hit.
        svc._call_gemini_vision_api = MagicMock(
            side_effect=AssertionError("LLM must not be called on local OCR hit")
        )
        req = AIVisionRequest(screenshot="img-b64", prompt='Find the "Submit" button')
        resp = _run(svc.analyze(req))
        assert resp.success is True
        assert (resp.x, resp.y) == (120, 60)
        assert svc.local_ocr_hits == 1
        assert svc.llm_calls == 0

    @patch.object(ai_vision_mod, "encode_image_base64", side_effect=lambda s: s)
    def test_falls_back_to_llm_when_local_misses(self, _enc):
        local = MagicMock(spec=LocalOCRService)
        local.is_available.return_value = True
        local.locate_text.return_value = LocalOCRResult(success=False, error="no match")
        svc = AIVisionService(local_ocr=local)
        _run(svc.initialize("fake-key"))

        async def fake_llm(*args, **kwargs):
            return AIVisionResponse(success=True, x=5, y=5, confidence=0.8)

        svc._call_gemini_vision_api = MagicMock(side_effect=fake_llm)
        req = AIVisionRequest(screenshot="img-b64", prompt='Find the "Submit" button')
        resp = _run(svc.analyze(req))
        assert resp.success is True
        assert (resp.x, resp.y) == (5, 5)
        assert svc.local_ocr_hits == 0
        assert svc.llm_calls == 1

    @patch.object(ai_vision_mod, "encode_image_base64", side_effect=lambda s: s)
    def test_reference_images_skip_local_ocr(self, _enc):
        # Reference images imply visual matching -> OCR is bypassed entirely.
        svc, local = self._service_with_local_hit()
        _run(svc.initialize("fake-key"))

        async def fake_llm(*args, **kwargs):
            return AIVisionResponse(success=True, x=9, y=9, confidence=0.8)

        svc._call_gemini_vision_api = MagicMock(side_effect=fake_llm)
        req = AIVisionRequest(
            screenshot="img-b64",
            prompt='Find the "Submit" button',
            reference_images=["ref-b64"],
        )
        resp = _run(svc.analyze(req))
        assert resp.success is True
        assert (resp.x, resp.y) == (9, 9)
        local.locate_text.assert_not_called()
        assert svc.llm_calls == 1

    @patch.object(ai_vision_mod, "encode_image_base64", side_effect=lambda s: s)
    def test_disabled_local_ocr_always_uses_llm(self, _enc):
        svc, local = self._service_with_local_hit()
        svc.set_local_ocr_enabled(False)
        _run(svc.initialize("fake-key"))

        async def fake_llm(*args, **kwargs):
            return AIVisionResponse(success=True, x=1, y=2, confidence=0.8)

        svc._call_gemini_vision_api = MagicMock(side_effect=fake_llm)
        req = AIVisionRequest(screenshot="img-b64", prompt='Find the "Submit" button')
        resp = _run(svc.analyze(req))
        assert (resp.x, resp.y) == (1, 2)
        local.locate_text.assert_not_called()
        assert svc.llm_calls == 1

    @patch.object(ai_vision_mod, "encode_image_base64", side_effect=lambda s: s)
    def test_local_ocr_applies_roi_offset(self, _enc):
        # When ROI cropping is used, the local hit coords must be offset back
        # into full-screen space.
        local = MagicMock(spec=LocalOCRService)
        local.is_available.return_value = True
        local.locate_text.return_value = LocalOCRResult(
            success=True, x=10, y=20, confidence=0.9, matched_text="Submit"
        )
        svc = AIVisionService(local_ocr=local)
        _run(svc.initialize("fake-key"))

        from .ai_vision_service import VisionROI
        with patch.object(ai_vision_mod, "crop_to_roi", side_effect=lambda b, *a: b):
            req = AIVisionRequest(
                screenshot="img-b64",
                prompt='Find the "Submit" button',
                roi=VisionROI(x=100, y=200, width=50, height=50),
            )
            resp = _run(svc.analyze(req))
        assert resp.success is True
        assert (resp.x, resp.y) == (110, 220)  # 10+100, 20+200
