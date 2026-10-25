# Agent Trace — Local Full-Stack MVP

A self-hosted, **single-user local Agent Trace platform** for Codex CLI and Claude Code. No account, cloud service, Docker, PostgreSQL or external API keys required. It reads explicitly authorized JSONL transcripts, retains encrypted evidence, merges events by native identifiers, and lets you browse execution history in a local web dashboard.

## Requirements

- Node.js **22.13+** (the bundled `node:sqlite` module is available in recent Node 22 builds; Node may print an experimental SQLite warning).
- macOS / Linux / Windows with a local JSONL directory.

## Quick start — working demo

```bash
git clone https://github.com/Scoheart/trace.git
cd trace
npm run import -- --agent codex --root ./fixtures/codex --consent
npm run import -- --agent claude --root ./fixtures/claude --consent
npm start
```

Open **http://127.0.0.1:4317**. There is no `npm install` step: the local MVP intentionally uses built-in Node.js modules, SQLite, HTML, CSS and JavaScript.

Alternatively, start with an empty local store and add your Agent directories through the **Data sources** panel:

```bash
npm start
```

1. Open `http://127.0.0.1:4317`.
2. Select **Data sources → Add a collector**.
3. Choose Codex CLI or Claude Code, enter the absolute local transcript directory and explicitly grant access.
4. Select **Connect source** to import history; enable auto-follow to collect subsequent JSONL records.
5. Go to **Trace explorer** to inspect Sessions, tool calls/results, token events, raw evidence, and fusion conflicts.

Usual source directory candidates (verify them for your installed Agent version):

- **Codex**: `~/.codex/sessions`
- **Claude Code**: `~/.claude/projects`

The browser input needs an **absolute path**, not a literal `~` abbreviation. Nothing outside your chosen directory is scanned. You can still use the CLI:

```bash
npm run import -- --agent codex --root "$HOME/.codex/sessions" --consent
npm run import -- --agent claude --root "$HOME/.claude/projects" --consent
npm run follow -- --agent codex --root "$HOME/.codex/sessions" --consent
```

For iterative local development:

```bash
npm run dev    # Node --watch, API + Dashboard + auto collector
npm run verify # tests + syntax checks
```

## MVP technology stack (all local)

| Layer | Implementation | Persistence |
| --- | --- | --- |
| Web UI | Static HTML/CSS/JS dashboard | Browser only |
| API | Node.js HTTP, loopback only | — |
| Configuration + scan history | SQLite `node:sqlite` | `.trace-data/sources.sqlite` |
| Capture runtime | Codex/Claude JSONL incremental adapter | SQLite source settings; checkpoints |
| Evidence | AES-256-GCM / SHA-256 encrypted object files | `.trace-data/objects` |
| Raw evidence index | Existing compatibility JSON index | `.trace-data/state.json` |
| Trace reconstruction | Claim projection + conservative native-call fusion | Computed on view |
| Background job | Interval-based same-process scan coordinator | SQLite run history |

This is a deliberately **monolithic local MVP**: each tier exists and is runnable without separate services. It preserves clear internal boundaries (`source-registry`, `capture-service`, `importer`, `fusion`, `server`, `public`) so the system can later migrate to TypeScript/Next.js, PostgreSQL, cloud blob storage and a multi-tenant API without replacing the capture format.

## Local HTTP endpoints

| Endpoint | Use |
| --- | --- |
| `GET /api/bootstrap` | Local mode and per-process CSRF token |
| `GET /api/overview` | Session, evidence and connected-source counters |
| `GET /api/sources` | Registered local directories and scan status |
| `POST /api/sources` | Register an explicitly authorized directory |
| `POST /api/sources/:id/scan` | Import new records now |
| `PATCH /api/sources/:id` | Enable/disable automatic scanning |
| `DELETE /api/sources/:id` | Unregister a directory, retain historical evidence |
| `GET /api/sources/:id/runs` | Recent scan outcomes and errors |
| `GET /api/sessions` | Combined Agent session list |
| `GET /api/sessions/:id/timeline` | Paginated canonical timeline + coverage |
| `GET /api/evidence/:id` | Hash-verified retained source text |

Writes require a short-lived CSRF header obtained from the local UI. Browser clients should prefer the built-in Dashboard rather than calling mutation endpoints manually.

## Security and honest limitations

- The HTTP server **only listens on `127.0.0.1`** and checks Host headers. **Never expose its port through a proxy, tunnel or public network**: this single-user MVP has no login system.
- Directory registration requires explicit user consent. Data is never uploaded to cloud servers.
- The app attempts to sanitize known secrets before encryption, but **best-effort redaction is not guaranteed**. The per-instance AES key is stored beside the ciphertext; it is not a password-derived secret or OS Keychain credential.
- Removing a source does **not** delete previously captured transcripts. To delete all history, stop the app and remove its `.trace-data` directory.
- Only Codex and Claude Code JSONL synthetic fixtures are regression-tested. Actual version compatibility and all L4 fields are **not guaranteed**. Hidden reasoning and events not exposed by Agents cannot be recovered.
- The existing fusion limits (2,500 records or 128 MiB per session request) remain; large sessions return a clear error rather than incomplete results.
- There is no hosted SaaS, no cross-device synchronization, no user accounts, and no arbitrary Agent execution. ZCode, OpenCode and Cursor adapters remain future work.

Implementation decisions: [`docs/superpowers/specs/2026-10-25-local-mvp-design.md`](docs/superpowers/specs/2026-10-25-local-mvp-design.md).
