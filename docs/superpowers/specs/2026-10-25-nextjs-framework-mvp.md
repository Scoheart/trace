# Next.js Framework MVP Migration

## Intent
Replace the user-facing vanilla HTML/DOM controller with an idiomatic Next.js App Router, React, TypeScript, Tailwind CSS, and shadcn-style component library while preserving the fully local, consent-based Agent Trace MVP.

## Scope
- Routes for sessions and source management; visible UI must be a React app.
- Reuse local encrypted evidence and SQLite source registry; do not migrate sensitive data to cloud.
- Single loopback port 4317 in dev and production via custom Next.js server integrating the existing API.
- Reuse existing read-only API endpoints and CSRF protections for mutations.
- Tests for native API delegation to Next, no unsafe HTML rendering; existing Node suite green.
- Build verification using GitHub Actions if dependencies cannot be downloaded in current container.

## Non-goals
- Introducing SaaS, accounts, cloud sync, remote binding, unsupported Agent adapters, environment re-execution, or a whole new back-end stack.

## Technical decisions
Next.js 16.4.3 / React 19.3.1, Tailwind 4, TypeScript, lucide-react and small shadcn-style local components. Existing Node HTTP API remains for now, to protect its P0/P1 stability. Legacy static assets remain only for backwards compatible bare-server tests; regular runs route to Next.js exclusively.

## Security
Untrusted events render as escaped React text nodes. Local API and UI bind only 127.0.0.1; existing Host validation and CSRF requirements remain enforced. Do not add untrusted HTML rendering.
