# TODO

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
