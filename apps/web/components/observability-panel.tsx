"use client";

import { useMemo, useState } from "react";
import { Activity, Clock3 } from "lucide-react";
import type { TraceEvent } from "../lib/types";
import { toObservedToolWaterfall, toToolTimeline } from "../lib/observability";
import { ToolTimeline } from "./assistant-ui/elements/tool-timeline";
import { TraceWaterfall } from "./assistant-ui/elements/trace-waterfall";

export function ObservabilityPanel({
  events, totalEvents, hasMore,
}: {
  events: readonly TraceEvent[];
  totalEvents: number | null;
  hasMore: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { steps, stats } = useMemo(() => toToolTimeline(events), [events]);
  const waterfall = useMemo(() => toObservedToolWaterfall(events), [events]);
  if (!events.length) return null;

  return (
    <section aria-label="Observed tool activity" className="m-4 space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Activity size={15} className="text-cyan-300" /> Observability</h3>
          <p className="mt-1 text-xs text-slate-400">Source-backed tool timeline · not a simulated Agent run</p>
        </div>
        <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{events.length}/{totalEvents ?? events.length} events loaded</span>
      </div>
      {steps.length ? (
        <ToolTimeline
          className="!max-w-full"
          steps={steps}
          visibleSteps={steps.length}
          streaming={false}
          open={open}
          onOpenChange={setOpen}
          restingLabel={`${steps.length} observed tool/file step(s)`}
          activeLabel="Capturing"
          stats={stats}
        />
      ) : <p className="text-xs text-slate-500">No observed tool, MCP, Skill or file-change events in the loaded records.</p>}
      {waterfall ? (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="flex items-center gap-2 text-xs font-medium text-slate-300"><Clock3 size={13} /> Tool-call intervals</p>
          <TraceWaterfall className="!max-w-full !rounded-lg !border-slate-700 !bg-slate-950"
            spans={waterfall.spans} totalMs={waterfall.totalMs} visibleCount={waterfall.spans.length} />
          <p className="text-[11px] leading-5 text-slate-500">Durations are differences between provider-recorded call/result timestamps connected by native tool IDs. They are not model latency or total Agent runtime.</p>
        </div>
      ) : <p className="border-t border-slate-800 pt-3 text-xs text-amber-200/85">A duration waterfall is unavailable: these loaded events do not contain reliably linked tool-call and result timestamps.</p>}
      {hasMore && <p className="text-[11px] text-slate-500">More events remain on the server; this summary covers the currently loaded page only.</p>}
    </section>
  );
}
