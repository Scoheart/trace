# Local Full-Stack MVP Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans with tests first, then implementation.

**Goal:** Turn the existing trace-only prototype into a locally runnable Agent Trace application with source management, collector, SQLite registry and web dashboard.

**Architecture:** Extend the existing Node.js HTTP API and encrypted EvidenceStore, add SQLite for source registry and scan history, a safe interval-based capture coordinator, and same-origin CSRF-protected routes. Reuse the existing evidence fusion and viewer; add source/overview panels.

**Tech Stack:** Node.js 22, built-in node:sqlite, built-in http, HTML/CSS/JS SPA, filesystem AES-256-GCM evidence blobs; no external runtime dependencies.

**Spec:** docs/superpowers/specs/2026-10-25-local-mvp-design.md

## Global constraints
- Explicit consent is required to read Agent directories.
- No cloud upload and no process execution / arbitrary shell commands.
- Bind only loopback, protect writes from cross-origin requests.
- SQLite schema must survive restart; old raw storage format stays readable.

## Review focus
1. Duplicate source roots produce one registry entry, not duplicate scanners.
2. Missing/broken Agent directories are rejected at registration and surfaced as scan errors later.
3. Concurrent scans cannot corrupt checkpointed raw evidence.
4. Foreign web pages cannot activate local scans without same-origin CSRF token.
5. Restart preserves sources and previous imported sessions.

## Tasks
### Task 1: Registry
- [ ] Write test for source CRUD, consent and persistence; run to fail.
- [ ] Add `src/source-registry.js` backed by SQLite; run test.
- [ ] Commit registry and tests.

### Task 2: Capture coordinator
- [ ] Write test for queued scan, last status and auto-follow; run to fail.
- [ ] Add `src/capture-service.js` using existing `importAgent`; run test.
- [ ] Commit collector and tests.

### Task 3: Local HTTP API and CSRF
- [ ] Write test for bootstrap, source creation/scan and CSRF rejection; run to fail.
- [ ] Extend `src/server.js`; run tests.
- [ ] Commit API and tests.

### Task 4: Dashboard and packaging
- [ ] Write smoke test for UI elements; run to fail.
- [ ] Extend `public` dashboard and CLI; document one-command local launch; run suite.
- [ ] Commit dashboard, README, example and verification evidence.
