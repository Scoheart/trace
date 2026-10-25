# Next.js Framework MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the existing Agent Trace MVP with a fully framework-based React/Next.js frontend, single-port local server and no regression of local capture features.

**Architecture:** Next.js App Router runs under an explicit local custom Node.js server. Paths under /api stay handled by the existing Node.js API; every other route is delegated to Next. React screens call typed API helpers and are composed from Tailwind and reusable UI primitives.

**Tech Stack:** Next.js 16.4, React 19.3, TypeScript, Tailwind 4, node:sqlite and existing local capture core.

**Spec:** docs/superpowers/specs/2026-10-25-nextjs-framework-mvp.md

## Global Constraints
- Fully local, zero cloud service prerequisites; bind only to 127.0.0.1.
- Preserve existing /api behavior, SQLite registry and encrypted evidence.
- Don't render untrusted model outputs as HTML.

## Review Focus
- Non-API requests get delegated without bypassing Host checks; test.
- API mutations still require CSRF token; run existing tests.
- Concurrent fast session switching doesn't display stale results; guard in UI.
- No mandatory cloud API or telemetry; inspect package/scripts.
- A first-time install starts from npm install, npm run dev; documentation.

---

### Task 1: Server request delegation
**Files:** src/server.js; test/framework-server.test.js
- [ ] Write failing test that non-API GET routes to Next handler but /api/health does not.
- [ ] Run test to observe the expected failure.
- [ ] Add optional uiHandler injection to createServer, route all non-API paths to it.
- [ ] Run focused and complete Node test suite.
- [ ] Commit.

### Task 2: React component UI and typed API
**Files:** apps/web/app/*, apps/web/components/*, apps/web/lib/*, apps/web/tsconfig.json, apps/web/next.config.ts, apps/web/postcss.config.mjs
- [ ] Add API typing and client view models.
- [ ] Implement layout, session explorer, timeline, inspector, source manager.
- [ ] Implement composable UI primitives and Tailwind CSS theme.
- [ ] Run syntax/source checks where possible.
- [ ] Commit.

### Task 3: Framework lifecycle and CI
**Files:** scripts/start-framework.mjs, package.json, README.md, .github/workflows/ci.yml, .gitignore
- [ ] Integrate framework dev and start, preserve CLI import/follow.
- [ ] Update CI to install dependencies, Next build, and full Node tests.
- [ ] Run full existing suite locally; verify GitHub Actions remote build.
- [ ] Commit and update existing MVP PR.
