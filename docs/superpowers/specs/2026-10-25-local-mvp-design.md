# Agent Trace — Local Full-Stack MVP Design

**User direction:** implement the existing multi-agent Trace project locally first, not a cloud SaaS. Reuse the approved P0/P1 evidence-first architecture and L4 historical viewer. Public SaaS, replay execution, arbitrary closed-agent introspection, and ZCode/Cursor support are out of MVP scope.

**Selected build:** single Node.js 22+ process with local browser dashboard and REST API, a SQLite data-source/run registry, explicit-consent Codex/Claude JSONL collector, encrypted raw evidence blobs, and on-demand canonical timeline fusion. No Docker, Redis, Postgres, accounts, or network access required for the MVP. Local web/UI and API are bundled and served on loopback. This deliberately prioritizes an actually runnable local stack over prematurely adding microservices.

**User outcome:** launch the app; register an explicitly authorized Agent transcript directory in the browser; manually scan or enable automatic incremental collection; navigate per-agent sessions; inspect events and original retained evidence; inspect collection status and errors, all without a cloud account.

**Security:** localhost-only bind and Host validation; require same-origin + per-process CSRF token for writes; use consent checkbox and explicit root; never run arbitrary commands; do not upload data; persist source and run metadata in private SQLite database; keep AES-GCM blob encryption and checkpointing; treat redaction as best-effort.

**Tradeoffs:** SQLite stores configuration, jobs and overview; existing JSON metadata index continues to back Raw Evidence for compatibility, rather than risky migration. This is a local single-user MVP, not shared or production-ready SaaS. Hidden events cannot be recovered. Tests use synthetic fixtures. Large sessions remain limited by existing fusion bounds.

**Acceptance:** Node.js 22+; `npm test` green; `npm run dev` starts local API + UI; source registration/scan/follow flows; restart preserves sources and records; source path access is consent-gated; write endpoint rejects cross-origin/CSRF; no cloud dependency.
