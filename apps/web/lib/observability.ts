import { FileCode2, GitBranch, Terminal, Wrench, Waypoints } from "lucide-react";
import type { TraceEvent } from "./types";
import type { TraceSpan } from "../components/assistant-ui/elements/trace-waterfall";
import type { TimelineStat, TimelineStep } from "../components/assistant-ui/elements/tool-timeline";

/** A summary of *observed* tool events, never a reconstructed chat/runtime. */
export function toToolTimeline(events: readonly TraceEvent[]): {
  steps: TimelineStep[];
  stats: TimelineStat[];
} {
  const steps: TimelineStep[] = [];
  const stats: TimelineStat[] = [];
  for (const event of events) {
    if (event.kind === "tool_call" || event.kind === "mcp" || event.kind === "shell" || event.kind === "skill") {
      steps.push({
        id: event.eventId,
        verb: event.kind === "mcp" ? "MCP" : event.kind === "skill" ? "Skill" : event.kind === "shell" ? "Ran" : "Called",
        chip: (event.summary || event.callId || "Unknown tool").slice(0, 80),
        icon: event.kind === "mcp" ? Waypoints : event.kind === "skill" ? GitBranch :
          event.kind === "shell" ? Terminal : Wrench,
      });
    } else if (event.kind === "file_change" && event.content && typeof event.content === "object" && !Array.isArray(event.content)) {
      const c = event.content as Record<string, unknown>;
      const file = typeof c.file === "string" ? c.file : typeof c.path === "string" ? c.path : null;
      const added = typeof c.added === "number" && Number.isSafeInteger(c.added) && c.added >= 0 ? c.added : undefined;
      const removed = typeof c.removed === "number" && Number.isSafeInteger(c.removed) && c.removed >= 0 ? c.removed : undefined;
      if (file) {
        steps.push({ id: event.eventId, verb: "Edited", chip: file.slice(0, 80), icon: FileCode2 });
        stats.push({ file, ...(added === undefined ? {} : { added }), ...(removed === undefined ? {} : { removed }) });
      }
    }
  }
  return { steps, stats };
}

function occurrence(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export interface ObservedToolWaterfall {
  spans: TraceSpan[];
  totalMs: number;
  startAt: string;
  endAt: string;
}

/**
 * Tool-only intervals. Both boundaries MUST be provider-recorded occurredAt values,
 * connected by the canonical native call/result edge. No observedAt fallback,
 * no imaginary LLM span, no guessing timing from transcript order.
 */
export function toObservedToolWaterfall(events: readonly TraceEvent[]): ObservedToolWaterfall | null {
  const endByParent = new Map<string, number[]>();
  for (const event of events) {
    if (event.kind !== "tool_result" || !event.parentEventId) continue;
    const end = occurrence(event.occurredAt);
    if (end === null) continue;
    const endings = endByParent.get(event.parentEventId) ?? [];
    endings.push(end);
    endByParent.set(event.parentEventId, endings);
  }
  const intervals: Array<{event: TraceEvent; start: number; end: number}> = [];
  for (const event of events) {
    if (event.kind !== "tool_call") continue;
    const start = occurrence(event.occurredAt);
    if (start === null) continue;
    const end = (endByParent.get(event.eventId) ?? []).filter(value => value >= start).sort((a, b) => a - b)[0];
    if (end === undefined) continue;
    intervals.push({ event, start, end });
  }
  if (!intervals.length) return null;
  const first = Math.min(...intervals.map(x => x.start));
  const last = Math.max(...intervals.map(x => x.end));
  if (last <= first) return null;
  const spans: TraceSpan[] = intervals.sort((a,b) => a.start-b.start).map(({event,start,end})=>({
    id:event.eventId,
    name:event.summary || event.callId || "Tool",
    depth:0,
    startMs:start-first,
    durationMs:end-start,
    status:"completed",
  }));
  return { spans, totalMs:last-first, startAt:new Date(first).toISOString(), endAt:new Date(last).toISOString() };
}
