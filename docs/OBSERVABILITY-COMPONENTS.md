# Observability UI components — current integration

This implementation **reuses real existing React components**, not a newly invented trace renderer.

- **shadcn/ui Trace**: copied and locally adapted from [shadcn-ui/ui](https://github.com/shadcn-ui/ui/blob/617134d5810bba521803b3ed787190bacbb80b35/apps/v4/registry/bases/radix/ui/trace.tsx); MIT notice in `apps/web/components/ui/UPSTREAM_LICENSE.txt`. Used to structure the interactive canonical event timeline and maintain its existing Inspector selection.
- **assistant-ui ToolTimeline**: copied from [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui/blob/65ce080d4a665fdb08c7e8795c6e628bae581d34/packages/ui/src/components/react/assistant-ui/elements/tool-timeline.tsx); MIT notice in `apps/web/components/assistant-ui/UPSTREAM_LICENSE.txt`. Displays a collapsible summary of captured tools and file changes.
- **assistant-ui TraceWaterfall**: copied from the same pinned source revision in Standalone mode. Displays **only time intervals** with a real logged call start and linked logged result end.
- **Canonical-to-component adapter**: `apps/web/lib/observability.ts`, independent from backend capture and model-specific chat runtimes.

## Why conditional waterfall?

Current `TraceEvent` has `occurredAt`, `observedAt`, and `parentEventId`, but no generic span start/end/duration. The adapter computes elapsed time **only** when both occurredAt timestamps belong to a call/result pair linked by `parentEventId`. It never substitutes collector observation time or infers missing LLM call times. Negative/skewed intervals are ignored. A missing waterfall therefore means *unverified timing data*, not that the run took zero time.

## Not implemented by components

Agent adapters and collection, missing tool outputs, nested span reconstruction, token-cost accounting, secure evidence storage, access control, and entire-session replay semantics remain responsibilities of this project's backend. The ToolTimeline is a summary of **loaded** records and not an assertion of complete Agent runtime coverage.

## Regenerate upstream elements

See official [assistant-ui Elements](https://www.assistant-ui.com/elements/trace-waterfall) and [shadcn Trace](https://ui.shadcn.com/docs/components/trace) docs. Local source files are intentionally vendored and pinned, consistent with registry copy-into-project patterns. Do not run generic chat-runtime initialization just for the Trace components.
