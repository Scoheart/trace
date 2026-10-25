# Agent Trace Platform

Local-first, consent-based historical trace prototype for Codex CLI and Claude Code (Node.js 22+). It imports JSONL transcripts, retains sanitized AES-256-GCM encrypted evidence and exposes a provenance-aware historical playback UI. The included samples are **synthetic**. This is **not** the complete multi-agent L4 SaaS product.

## Try it

```bash
npm test
npm run import -- --agent codex --root ./fixtures/codex --consent
npm run import -- --agent claude --root ./fixtures/claude --consent
npm start
```

Visit http://127.0.0.1:4317. Real local data may be imported by explicitly specifying your own authorized session root, for example:

```bash
node src/cli.js import --agent codex --root "$HOME/.codex/sessions" --consent
node src/cli.js import --agent claude --root "$HOME/.claude/projects" --consent
node src/cli.js follow --agent codex --root "$HOME/.codex/sessions" --consent --interval 3000
```

Paths above are examples, not automatic discovery. Do not scan locations you do not own or intend to authorize.

## Implemented

- Byte-offset checkpointing, JSONL rotation/truncation safeguards, batching, restart-safe import, and incomplete-line deferral.
- Deterministic evidence IDs, SHA-256 verification and encrypted at-rest blobs. Redaction happens before storage and is **best effort only**.
- Historical session association, provenance-aware event claims, duplicate native tool call/result matching and conflict preservation.
- Causal call/result relationships only where supported by native call IDs, not timestamps.
- Read-only session timeline viewer with source drilldown, local filtering, observed vs unknown coverage, and raw evidence verification.
- Built-in Node.js tests and GitHub Actions CI.

## HTTP API

- `GET /api/sessions`
- `GET /api/sessions/:sessionId/timeline?offset=0&limit=100`
- `GET /api/evidence/:evidenceId`
- `GET /api/sessions/:sessionId` (legacy projection)

The timeline explicitly rejects a session above 2,500 raw records or 128 MiB rather than pretending to show complete results.

## Security & limits

The unauthenticated viewer **only binds to 127.0.0.1** and must never be exposed through a tunnel or port forwarding. No cloud upload or remote access is implemented. A local encryption key is stored beside the ciphertext, not in the operating system Keychain. Redaction is not guaranteed to catch every secret and private source code may remain. Never commit actual session transcripts.

The test suite uses synthetic fixtures; present-day vendor versions, full L4 coverage, closed-source internals, ZCode, OpenCode, cloud account import and production multi-user SaaS are **not verified/implemented**. The browser E2E smoke test (`python test/e2e_viewer.py`) requires Playwright + Chromium; it is optional and not included in `npm test`.

See `docs/STATUS.md` and `docs/COMPATIBILITY.md`.
