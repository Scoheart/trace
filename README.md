# Agent Trace · Local Framework MVP

A self-hosted **Next.js + React + TypeScript + Tailwind CSS** interface for Agent Trace, with a local Node.js API, SQLite source registry, evidence-first encrypted storage, and historical playback.

The UI lives under `apps/web` and is built with composable React components. The existing capture, parsing, fusion and local evidence-storage engine is reused without exposing it to the network or cloud.

## Requirements

- **Node.js 22.13+**, npm 10+
- macOS, Linux or Windows with explicit access to the Agent transcript folders
- Internet is required **once for npm install**, but the platform uses **no cloud service at runtime**

## Run the complete framework MVP

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:4317**. The local UI and capture API share a single port and origin.

To run the production build locally:

```bash
npm run build
npm start
```

Optional local storage settings:

```bash
TRACE_PORT=4318 TRACE_STORE="$HOME/.agent-trace" npm run dev
```

Do not bind this app to public network interfaces; it is a single-user, unauthenticated local MVP.

## Explore sample sessions

```bash
npm run import -- --agent codex --root ./fixtures/codex --consent
npm run import -- --agent claude --root ./fixtures/claude --consent
npm run dev
```

Go to **Trace explorer** to view Session → timeline → Tool / MCP records → provenance → original encrypted evidence. Tool results are matched to Tool calls using native IDs where available; unknown categories are marked *not verified*.

Go to **Data sources** to authorize a directory, import historical records and turn on automatic incremental scanning. The UI works with source directories you explicitly consent to; there is no system-wide scanning.

Default directory examples:

```bash
# macOS and Linux examples — verify these are correct for your installed Agent version.
# Codex
$HOME/.codex/sessions
# Claude Code
$HOME/.claude/projects
```

## Architecture

```text
 apps/web/ (Next.js 16, React 19, TypeScript, Tailwind 4)
          │  same-origin localhost:4317
          ▼
 src/server.js (local Node HTTP API, CSRF + Host validation)
      ├── src/source-registry.js → SQLite (node:sqlite)
      ├── src/capture-service.js → authorized polling imports
      ├── src/importer.js + adapters → Codex / Claude JSONL
      ├── src/store.js → encrypted raw evidence + checkpoints
      └── src/fusion.js → canonical historical trace projection
```

The local `scripts/start-framework.mjs` uses Next.js's supported custom-server interface to host both Next routes and the capture API on **127.0.0.1**, without a proxy, Docker or a second service. This local-only custom server is **not** designed for serverless deployment; a future SaaS deployment should split the API from Next.

### Project layout

- `apps/web/app/` — App Router pages (`/sessions`, `/sources`)
- `apps/web/components/` — React screens, shadcn-style reusable UI primitives
- `apps/web/lib/` — typed client API and canonical trace types
- `src/` — unchanged privacy-sensitive capture/storage/fusion core
- `test/` — capture, API, core fusion and framework boundary tests
- `fixtures/` — synthetic sample transcripts (no real user content)

## Validation

```bash
npm test            # dependency-free capture/API tests
npm run typecheck   # TypeScript (after npm install)
npm run build       # Next.js production build (after npm install)
```

The previous `public/` HTML UI is retained as a **legacy test-only fallback** for `npm run legacy:serve`, so existing Node API tests remain valid. **The default `npm run dev` / `npm start` UI uses Next.js and React.**

## Security and limitations

- Evidence is encrypted with AES-256-GCM, verified with SHA-256, and stays local. The encryption key is stored alongside local encrypted data, not in OS secure storage.
- Sanitization is **best-effort**; do not expose the HTTP port beyond localhost or upload real transcripts publicly.
- Only synthetic-fixture Codex CLI and Claude Code adapters have been tested. No ZCode/OpenCode adapter, cloud sync, SaaS tenancy or environment re-execution is implemented.
- A session with over 2,500 raw records or over 128 MiB is rejected rather than silently truncated.
- Not all L4 event types can be obtained from every third-party Agent. The UI displays observed evidence only and does not manufacture unavailable records.
