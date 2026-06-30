# Implementation Plan: Local OCR Token Optimization

- [x] 1. Create `LocalOCRService` module
  - [x] 1.1 Optional dependency probing for `pytesseract` (no hard import failure)
    - `_probe_pytesseract()` returns module or None
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 Data classes `OCRMatch`, `LocalOCRResult`
    - _Requirements: 4.2_
  - [x] 1.3 Pure helpers `normalize_text`, `text_match_score`
    - Tiers: exact 1.0 / whole-word 0.9 / substring 0.75 / 0.0; no fuzzy
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 1.4 `is_available()` (pytesseract + working binary)
    - _Requirements: 5.1_
  - [x] 1.5 `extract_text_boxes()` via `image_to_data`
    - Skip empty text and conf < 0; normalize confidence to [0..1]
    - _Requirements: 1.1_
  - [x] 1.6 `locate_text()` picks max Combined_Confidence ≥ threshold
    - _Requirements: 1.2, 3.5_
  - [x] 1.7 `extract_query_from_prompt()` (quoted phrase, Unicode-safe)
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Integrate fast-path into `AIVisionService`
  - [x] 2.1 `__init__(local_ocr, enable_local_ocr)` + `set_local_ocr_enabled()`
    - _Requirements: 6.3_
  - [x] 2.2 `_try_local_ocr()` helper (availability → query → locate → ROI offset)
    - Swallow all exceptions → return None (Fallback)
    - _Requirements: 1.1, 4.1, 5.3_
  - [x] 2.3 Call OCR before LLM in `analyze()`; skip when reference_images present
    - _Requirements: 1.1, 1.4_
  - [x] 2.4 Telemetry counters `local_ocr_hits` / `llm_calls`
    - _Requirements: 6.1, 6.2_

- [x] 3. Export from package and document
  - [x] 3.1 Update `vision/__init__.py` exports
  - [x] 3.2 Add `pytesseract` (optional) to `requirements.txt`
  - [x] 3.3 Document fast-path in `ai-vision-capture/design.md`

- [x] 4. Tests (`vision/test_local_ocr_service.py`, 29 tests)
  - [x] 4.1 normalize_text / text_match_score / extract_query_from_prompt
    - **Property 7, 8** — _Requirements: 2, 3_
  - [x] 4.2 Availability + graceful degradation (pytesseract/binary missing)
    - **Property 6** — _Requirements: 5_
  - [x] 4.3 locate_text with injected fake engine (hit/miss/best-of-many)
    - _Requirements: 1.2, 3.5_
  - [x] 4.4 AIVisionService integration: local hit skips LLM; miss falls back;
        reference images bypass; disabled ⇒ LLM; ROI offset applied
    - **Property 1, 2, 3, 4, 5** — _Requirements: 1, 4, 6_

- [x] 5. End-to-end self-running verification on macOS
  - [x] 5.1 Real Tesseract locate on a synthetic rendered label (0 token)
  - [x] 5.2 Full automation loop demo: screenshot → OCR/scan text → build script
        → execute (dry-run) → LLM-coordinate fallback path → token accounting
    - See `python-core/examples/self_running_macos_demo.py`

- [x] 6. Final Checkpoint — all OCR tests pass, no regressions
  - 330 python tests green (incl. 29 new); 369 rust; 514 desktop services+utils
