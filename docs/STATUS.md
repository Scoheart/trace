# Implementation status

P0 + P1 **local technical prototype**, not a public SaaS.

Implemented: authorized Codex/Claude JSONL import and polling follow, incremental byte checkpoints, encrypted retained evidence, provenance claims, session grouping, matching of native Tool Calls/Results, conflict retention, cause-linked display, local history viewer and search across loaded events.

Known limits: synthetic-fixture verification only; full L4 coverage not guaranteed. No cloud sync, no Hook/OTLP ingress, no current ZCode/OpenCode adapter, no multiple-user tenancy, no persistent incremental fusion projection. A timeline above 2,500 records or 128 MiB returns HTTP 413. Local redaction is best effort; encrypted blobs and the 32-byte key both reside on the same device. The Viewer is unauthenticated and **must not** be exposed beyond 127.0.0.1. Optional Playwright/Chromium test may be blocked in restricted CI.
