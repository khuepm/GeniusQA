"""
Local OCR Service for AI Vision Capture (token-saving fallback).

This service locates on-screen text elements using a LOCAL OCR engine
(Tesseract via pytesseract) instead of calling a paid cloud Vision LLM.

Why this exists
---------------
The cloud Vision LLM (Gemini) is accurate but every analysis costs tokens and
requires network access. A large fraction of real automation targets are plain
text labels ("Submit", "Login", "Đăng nhập", ...). For those, a local OCR pass
can find the element with ZERO token cost and no network dependency.

Strategy: the AIVisionService tries this local OCR path FIRST. Only when local
OCR cannot confidently locate the requested text does it fall back to the cloud
LLM. This is the primary token-optimization mechanism for text targets.

Design notes
------------
- pytesseract / the tesseract binary are OPTIONAL. If either is unavailable the
  service degrades gracefully (is_available() -> False) and the caller simply
  uses the LLM path. Nothing here is a hard dependency.
- The matcher is intentionally conservative: it only reports `found=True` when a
  reasonably strong textual match exists, so we never silently click the wrong
  element. Ambiguous cases defer to the LLM.

Requirements: token optimization for ai-vision-capture (local text fallback).
"""

import re
from dataclasses import dataclass
from typing import List, Optional

from .image_utils import decode_image_base64, encode_image_base64


# ============================================================================
# Optional dependency probing (no hard import failure)
# ============================================================================

def _probe_pytesseract():
    """Return the pytesseract module if importable, else None."""
    try:
        import pytesseract  # type: ignore
        return pytesseract
    except Exception:
        return None


_pytesseract = _probe_pytesseract()


# ============================================================================
# Data classes
# ============================================================================

@dataclass
class OCRMatch:
    """A single OCR text box with its center coordinates and confidence."""
    text: str
    x: int          # center x (pixels)
    y: int          # center y (pixels)
    confidence: float  # 0.0 - 1.0
    left: int
    top: int
    width: int
    height: int


@dataclass
class LocalOCRResult:
    """Result of a local OCR locate attempt."""
    success: bool
    x: Optional[int] = None
    y: Optional[int] = None
    confidence: Optional[float] = None
    matched_text: Optional[str] = None
    error: Optional[str] = None


# ============================================================================
# Text normalization / matching helpers
# ============================================================================

def normalize_text(text: str) -> str:
    """
    Normalize text for tolerant comparison.

    Lowercases, collapses whitespace, and strips surrounding punctuation so that
    "Submit", " submit ", and "Submit:" all compare equal.
    """
    if not text:
        return ""
    collapsed = re.sub(r"\s+", " ", text).strip().lower()
    # Strip leading/trailing punctuation but keep internal characters intact.
    return collapsed.strip(" \t\n\r.,:;!?\"'()[]{}<>|")


def text_match_score(query: str, candidate: str) -> float:
    """
    Score how well `candidate` text matches the `query`, in [0.0, 1.0].

    Tiers (most → least confident):
      1.0  exact normalized equality
      0.9  candidate equals query as a whole word inside it
      0.75 query is a contained substring (or vice-versa) of meaningful length
      0.0  otherwise

    Kept deliberately simple and conservative — fuzzy edit-distance matching is
    intentionally avoided so we don't click the wrong control on a near-miss.
    """
    q = normalize_text(query)
    c = normalize_text(candidate)
    if not q or not c:
        return 0.0
    if q == c:
        return 1.0
    # whole-word containment
    if re.search(rf"(?:^|\s){re.escape(q)}(?:$|\s)", c):
        return 0.9
    # substring containment, but only when the query is non-trivial
    if len(q) >= 3 and (q in c or c in q):
        return 0.75
    return 0.0


# ============================================================================
# Service
# ============================================================================

class LocalOCRService:
    """
    Locate on-screen text using local Tesseract OCR (zero token cost).

    Example:
        >>> svc = LocalOCRService()
        >>> if svc.is_available():
        ...     result = svc.locate_text(screenshot_base64, "Submit")
        ...     if result.success:
        ...         click(result.x, result.y)
    """

    # Minimum combined confidence (OCR confidence * match score) required to
    # accept a local hit. Below this we defer to the cloud LLM.
    DEFAULT_MIN_CONFIDENCE = 0.5

    def __init__(self, min_confidence: float = DEFAULT_MIN_CONFIDENCE):
        self._min_confidence = min_confidence

    def is_available(self) -> bool:
        """
        True only if pytesseract is importable AND the tesseract binary works.

        This double-check means the caller never has to handle a missing binary
        at locate time — an unavailable engine simply means "use the LLM".
        """
        if _pytesseract is None:
            return False
        try:
            _pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def extract_text_boxes(self, screenshot: str, lang: Optional[str] = None) -> List[OCRMatch]:
        """
        Run OCR over the screenshot and return all detected text boxes.

        Args:
            screenshot: base64 string, data URL, or file path.
            lang: optional Tesseract language string (e.g. "eng+vie").

        Returns:
            List of OCRMatch. Empty list if OCR is unavailable or finds nothing.
        """
        if not self.is_available():
            return []

        try:
            image = decode_image_base64(encode_image_base64(screenshot))
        except Exception:
            return []

        # Tesseract reads RGB; convert to be safe across PNG/RGBA inputs.
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        try:
            config_kwargs = {"output_type": _pytesseract.Output.DICT}
            if lang:
                config_kwargs["lang"] = lang
            data = _pytesseract.image_to_data(image, **config_kwargs)
        except Exception:
            return []

        matches: List[OCRMatch] = []
        n = len(data.get("text", []))
        for i in range(n):
            raw_text = (data["text"][i] or "").strip()
            if not raw_text:
                continue
            try:
                conf_raw = float(data["conf"][i])
            except (ValueError, TypeError):
                continue
            # Tesseract returns -1 for non-text regions.
            if conf_raw < 0:
                continue
            left = int(data["left"][i])
            top = int(data["top"][i])
            width = int(data["width"][i])
            height = int(data["height"][i])
            matches.append(
                OCRMatch(
                    text=raw_text,
                    x=left + width // 2,
                    y=top + height // 2,
                    confidence=max(0.0, min(1.0, conf_raw / 100.0)),
                    left=left,
                    top=top,
                    width=width,
                    height=height,
                )
            )
        return matches

    def locate_text(
        self,
        screenshot: str,
        query: str,
        lang: Optional[str] = None,
    ) -> LocalOCRResult:
        """
        Find the best on-screen match for `query` text.

        Returns a successful LocalOCRResult only when the combined confidence
        (OCR confidence * textual match score) meets the configured threshold;
        otherwise success=False so the caller can fall back to the cloud LLM.

        This call costs ZERO tokens and requires no network access.
        """
        if not self.is_available():
            return LocalOCRResult(success=False, error="Local OCR engine not available")
        if not query or not query.strip():
            return LocalOCRResult(success=False, error="Query text is required")

        boxes = self.extract_text_boxes(screenshot, lang=lang)
        if not boxes:
            return LocalOCRResult(success=False, error="No text detected on screen")

        best: Optional[OCRMatch] = None
        best_combined = 0.0
        best_match_score = 0.0
        for box in boxes:
            match_score = text_match_score(query, box.text)
            if match_score <= 0.0:
                continue
            combined = match_score * box.confidence
            if combined > best_combined:
                best_combined = combined
                best_match_score = match_score
                best = box

        if best is None or best_combined < self._min_confidence:
            return LocalOCRResult(
                success=False,
                error=f"No confident local match for '{query}' (best={best_combined:.2f})",
            )

        return LocalOCRResult(
            success=True,
            x=best.x,
            y=best.y,
            confidence=round(best_combined, 4),
            matched_text=best.text,
        )

    @staticmethod
    def extract_query_from_prompt(prompt: str) -> Optional[str]:
        """
        Best-effort extraction of a concrete text target from a natural-language
        prompt, so prompts like:  Find the "Submit" button  →  Submit

        Returns the quoted phrase when present, else None (meaning: this prompt
        is not obviously a simple text target — let the LLM handle it).
        """
        if not prompt:
            return None
        # Prefer an explicitly quoted phrase (single, double, or smart quotes).
        quoted = re.search(r"[\"'‘’“”]([^\"'‘’“”]{1,60})[\"'‘’“”]", prompt)
        if quoted:
            candidate = quoted.group(1).strip()
            return candidate or None
        return None
