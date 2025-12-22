# TODO

- [ ] Visual regression testing: wire end-to-end UI + playback + diff review.  
  - Status: pending

- [x] Script list: thêm nút Reveal in Finder (mở folder chứa file script) gần nút Delete.  
  - Status: completed

- [x] AI Builder: không hỏi lại Operating System (đã chọn target OS trên UI) và thêm nút Record để lấy tọa độ (x,y) cho username/password/login button.  
  - Status: completed

- [ ] AI Builder: thêm nút New chat (reset hội thoại) và nút Finish/Save để lưu script hiện tại và dẫn tới màn hình playback để test script AI build.  
  - Status: pending

- [x] Fix lỗi "Failed to generate script: API key not valid. Please pass a valid API key."  
  - Status: completed

- [x] Investigate and fix why Start Playback is not working in RecorderScreen (Python/Rust cores, IPC, events).  
  - Status: completed

- [x] Investigate and fix crash when running Rust core (record + playback), especially when pressing Cmd+Tab or other global keyboard shortcuts on macOS.  
  - Status: completed
  - Notes: Crashes occur with Rust core selected during both recording and playback when pressing Cmd+Tab; no Rust logs after "Recording session started successfully".

- [x] Migrate web app from Supabase to Firebase (reuse desktop Firebase auth + Firestore schema).  
  - Status: completed
  - Notes: Replace Supabase auth/data with Firebase; reuse existing Firebase env values; remove Supabase dependency.

- [ ] Update RECORDER_FIX_SUMMARY.md and memory.md with findings and fixes for Rust core crash.  
  - Status: pending
