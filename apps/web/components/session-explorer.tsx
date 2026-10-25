'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {
  Activity, AlertCircle, ArrowDown, ArrowRight, Braces, Check, ChevronRight,
  CircleAlert, Clock3, Code2, Database, Eye, FileCode2, FileText, GitBranch,
  Hash, Layers2, MessageSquare, PlayCircle, RefreshCw, Search,
  ShieldCheck, Terminal, Waypoints, Zap
} from 'lucide-react';
import {getJSON,formatDate,stringifyContent,truncateText} from '../lib/api';
import type {CaptureCoverage,RetainedEvidence,TimelinePage,TraceEvent,TraceSession} from '../lib/types';
import {cn} from '../lib/utils';
import {Button} from './ui/button';
import {Badge} from './ui/badge';
import {Card} from './ui/card';
import {Input,Select} from './ui/form-controls';
import {EmptyState} from './empty-state';

type KindFilter='all'|'tool'|'conversation'|'usage'|'errors'|'files';
const categorized:Record<Exclude<KindFilter,'all'>,string[]>={
  tool:['tool_call','tool_result','shell','mcp','skill','subagent'],
  conversation:['user_message','assistant_message','session'],
  usage:['usage'],errors:['error','invalid_json'],files:['file_change']
};
const iconByKind:Record<string,typeof Terminal>={
  session:Layers2,user_message:MessageSquare,assistant_message:MessageSquare,
  tool_call:Terminal,tool_result:Code2,usage:Zap,shell:Terminal,mcp:Waypoints,
  file_change:FileCode2,skill:Braces,subagent:GitBranch,error:AlertCircle,
  invalid_json:CircleAlert,other:FileText
};
const toneByKind:Record<string,'info'|'success'|'warning'|'danger'|'muted'>={
  session:'muted',user_message:'muted',assistant_message:'info',tool_call:'info',
  tool_result:'success',usage:'warning',shell:'info',file_change:'success',
  mcp:'info',skill:'info',subagent:'info',error:'danger',invalid_json:'danger'
};

function Stat({label,value,sub}:{label:string,value:string|number,sub:string}){
  return <Card className="min-w-0 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p><div className="mt-2 text-2xl font-bold tabular-nums text-slate-100">{value}</div><p className="mt-1 text-xs text-slate-500">{sub}</p></Card>;
}

function EvidenceRecord({id,record,loading,onExpand}:{id:string,record?:RetainedEvidence,loading:boolean,onExpand:()=>void}){
  return <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
    <button type="button" onClick={onExpand} className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-xs text-slate-300 hover:bg-slate-800/70">
      <span className="flex min-w-0 items-center gap-2"><Hash size={14} className="shrink-0 text-cyan-400"/><span className="truncate font-mono">{id.slice(0,20)}…</span></span>
      {loading?<RefreshCw size={14} className="animate-spin"/>:<ChevronRight size={14} className={cn('shrink-0 transition-transform',record&&'rotate-90')}/>}
    </button>
    {record&&<div className="space-y-3 border-t border-slate-800 px-3 py-3">
      <div className="flex flex-wrap gap-2"><Badge tone={record.hashVerified?'success':'danger'}>{record.hashVerified?'SHA-256 verified':'Unverified'}</Badge><Badge>{record.metadata.sourceKind}</Badge></div>
      <p className="break-all text-[11px] text-slate-400">{record.metadata.sourceName??'Unknown origin'} · byte {record.metadata.sourceByteOffset}</p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#080e17] p-3 font-mono text-[11px] leading-5 text-slate-300">{record.retainedText}</pre>
    </div>}
  </div>;
}

function Inspector({event}:{event:TraceEvent|null}){
  const [expanded,setExpanded]=useState<Record<string,RetainedEvidence>>({});
  const [openId,setOpenId]=useState<string|null>(null);
  const [loadingId,setLoadingId]=useState<string|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{setOpenId(null);setError('');},[event?.eventId]);
  async function toggleEvidence(id:string){
    if(openId===id){setOpenId(null);return;}
    setOpenId(id);
    if(expanded[id])return;
    setLoadingId(id);setError('');
    try{const raw=await getJSON<RetainedEvidence>(`/api/evidence/${id}`);
      setExpanded(cache=>({...cache,[id]:raw}));
    }catch(e){setError(e instanceof Error?e.message:'Evidence loading failed');}
    finally{setLoadingId(null);}
  }
  return <Card className="min-h-[420px] overflow-hidden lg:sticky lg:top-5 lg:max-h-[calc(100vh-140px)]">
    <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-400">Inspector</p><h2 className="mt-1 text-sm font-semibold">Event details</h2></div><Eye size={18} className="text-slate-500"/></div>
    {!event?<div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><div className="rounded-xl bg-slate-800/70 p-3 text-slate-400"><Eye size={20}/></div><p className="text-sm font-semibold">No event selected</p><p className="text-xs leading-5 text-slate-500">Select a timeline event to inspect content, provenance and retained raw evidence.</p></div>:
    <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-4 sm:p-5">
      <div><Badge tone={toneByKind[event.kind]??'muted'}>{event.kind.replaceAll('_',' ')}</Badge><h3 className="mt-2 break-words text-base font-semibold">{event.summary}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(event.occurredAt||event.observedAt)}</p></div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-slate-500">Correlation</dt><dd className="mt-1 font-medium text-slate-200">{event.identityStrength==='native_call'?'Native call ID':'Original record'}</dd></div>
        <div><dt className="text-slate-500">Source evidence</dt><dd className="mt-1 font-medium text-slate-200">{event.evidenceRefs.length} record(s)</dd></div>
        {event.callId&&<div className="col-span-2"><dt className="text-slate-500">Call ID</dt><dd className="mt-1 break-all font-mono text-cyan-300">{event.callId}</dd></div>}
        {event.parentEventId&&<div className="col-span-2"><dt className="text-slate-500">Parent event</dt><dd className="mt-1 break-all font-mono text-slate-300">{event.parentEventId}</dd></div>}
      </dl>
      <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Captured content</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-[#0a111d] p-3 font-mono text-xs leading-6 text-slate-200">{stringifyContent(event.content)}</pre></div>
      {event.conflicts.length>0&&<div><p className="mb-2 text-xs font-semibold text-amber-300">Conflicting evidence · {event.conflicts.length}</p><div className="space-y-2">{event.conflicts.map(conflict=><div key={conflict.field} className="rounded-lg border border-amber-600/25 bg-amber-500/5 p-3"><p className="mb-2 text-xs font-medium text-amber-200">Field: {conflict.field}</p>{conflict.alternatives.map(alt=><div key={alt.claimId} className="mt-2"><span className="text-[10px] font-mono text-slate-500">{alt.evidenceId.slice(0,12)}</span><pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-200">{stringifyContent(alt.value)}</pre></div>)}</div>)}</div></div>}
      {event.transformFlags.length>0&&<div className="flex items-center gap-2 text-xs text-amber-300"><ShieldCheck size={14}/>{event.transformFlags.join(', ')}</div>}
      <div><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Raw evidence</p><Badge>{event.evidenceRefs.length}</Badge></div><div className="space-y-2">{event.evidenceRefs.map(id=><EvidenceRecord key={id} id={id} record={openId===id?expanded[id]:undefined} loading={loadingId===id} onExpand={()=>toggleEvidence(id)}/>)}</div>{error&&<p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}</div>
    </div>}
  </Card>;
}

export function SessionExplorer(){
  const [sessions,setSessions]=useState<TraceSession[]>([]);
  const [selected,setSelected]=useState<TraceSession|null>(null);
  const [events,setEvents]=useState<TraceEvent[]>([]);
  const [selectedEvent,setSelectedEvent]=useState<TraceEvent|null>(null);
  const [coverage,setCoverage]=useState<CaptureCoverage|null>(null);
  const [totalEvents,setTotalEvents]=useState<number|null>(null);
  const [hasMore,setHasMore]=useState(false);
  const [loadingSessions,setLoadingSessions]=useState(true);
  const [loadingTimeline,setLoadingTimeline]=useState(false);
  const [error,setError]=useState('');
  const [kind,setKind]=useState<KindFilter>('all');
  const [query,setQuery]=useState('');
  const requestId=useRef(0);
  const selectedId=useRef<string|null>(null);
  const loadingMore=useRef(false);

  const refreshSessions=useCallback(async (signal?:AbortSignal)=>{
    try{const result=await getJSON<TraceSession[]>('/api/sessions',signal);
      setSessions(result);
    }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Failed to load sessions');}
    finally{setLoadingSessions(false);}
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void refreshSessions(controller.signal);
    const interval=setInterval(()=>{if(!document.hidden)void refreshSessions();},12000);
    return ()=>{controller.abort();clearInterval(interval);requestId.current++;};
  },[refreshSessions]);

  const fetchPage=useCallback(async (id:string,offset:number,requestNumber:number)=>{
    loadingMore.current=true;
    setLoadingTimeline(true);
    try{
      const page=await getJSON<TimelinePage>(`/api/sessions/${id}/timeline?offset=${offset}&limit=150`);
      if(requestId.current!==requestNumber || selectedId.current!==id)return;
      setEvents(current=>offset===0?page.events:[...current,...page.events]);
      setCoverage(page.coverage);setTotalEvents(page.totalEvents);setHasMore(page.hasMore);
      setError('');
    }catch(e){if(requestId.current===requestNumber)setError(e instanceof Error?e.message:'Could not load timeline');}
    finally{if(requestId.current===requestNumber){setLoadingTimeline(false);loadingMore.current=false;}}
  },[]);

  const selectSession=useCallback((session:TraceSession)=>{
    selectedId.current=session.sessionId;
    const token=++requestId.current;
    loadingMore.current=false;
    setSelected(session);setSelectedEvent(null);setEvents([]);setCoverage(null);setHasMore(false);
    setTotalEvents(null);setQuery('');setKind('all');setError('');
    void fetchPage(session.sessionId,0,token);
  },[fetchPage]);

  const filtered=useMemo(()=>events.filter(event=>{
    if(kind!=='all'&&!categorized[kind].includes(event.kind))return false;
    if(!query.trim())return true;
    const text=[event.kind,event.summary,event.callId,event.sourceName,stringifyContent(event.content)].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }),[events,query,kind]);
  const observed=coverage?Object.entries(coverage).filter(([,value])=>typeof value==='object' && value!==null && 'state' in value && value.state==='observed').map(([name])=>name):[];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-400"><Activity size={13}/> Trace Intelligence / Local</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Trace explorer</h1><p className="mt-2 text-sm text-slate-400">Inspect what really happened inside your agents. Every step backed by retained evidence.</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={()=>refreshSessions()}><RefreshCw size={14}/> Refresh</Button><Link href="/sources"><Button variant="primary" size="sm"><Database size={14}/> Connect agent</Button></Link></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Sessions" value={sessions.length} sub="Saved conversations"/>
      <Stat label="Source records" value={sessions.reduce((count,s)=>count+s.records,0).toLocaleString()} sub="Encrypted evidence"/>
      <Stat label="Current trace" value={totalEvents??'—'} sub="Canonical events observed"/>
    </div>
    {error&&<div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"><AlertCircle size={16}/><span>{error}</span></div>}
    {!loadingSessions&&sessions.length===0?<EmptyState icon={<Database size={24}/>} title="No traces yet" description="Connect your Codex or Claude Code transcript directory to import historical sessions. Your evidence stays on this device." action={<Link href="/sources"><Button variant="primary" size="sm">Set up a collector <ArrowRight size={14}/></Button></Link>}/>:
    <div className="grid min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)_320px] 2xl:grid-cols-[275px_minmax(0,1fr)_360px]">
      <Card className="overflow-hidden xl:min-h-[610px]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4"><span className="text-xs font-bold uppercase tracking-[.15em] text-slate-400">Sessions</span><Badge>{sessions.length}</Badge></div>
        <div className="max-h-96 space-y-1 overflow-auto p-2 xl:max-h-[720px]">
          {loadingSessions?<p className="px-3 py-8 text-center text-sm text-slate-400">Loading sessions…</p>:sessions.map(session=>{
            const active=selected?.sessionId===session.sessionId;
            return <button key={session.sessionId} type="button" onClick={()=>selectSession(session)} className={cn('w-full rounded-lg border p-3 text-left transition-colors',active?'border-cyan-400/25 bg-cyan-400/10':'border-transparent hover:bg-slate-800/60')} aria-pressed={active}>
              <div className="flex items-center justify-between"><Badge tone={session.agentId==='codex'?'info':'warning'}>{session.agentId==='codex'?'Codex':'Claude Code'}</Badge>{active&&<ChevronRight size={14} className="text-cyan-400"/>}</div>
              <div className="mt-2 break-all font-mono text-xs font-semibold text-slate-200">{truncateText(session.nativeSessionId||session.sessionId,40)}</div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500"><Clock3 size={12}/>{formatDate(session.lastObservedAt)}</div>
              <div className="mt-1 text-[11px] text-slate-500">{session.records} original record(s)</div>
            </button>;
          })}
        </div>
      </Card>
      <Card className="min-w-0 overflow-hidden xl:min-h-[610px]">
        <div className="border-b border-slate-800 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-cyan-400">Observed timeline</p><h2 className="mt-2 break-all text-base font-semibold">{selected?truncateText(selected.nativeSessionId||selected.sessionId,48):'Select a session'}</h2></div>{selected&&<Button variant="ghost" size="sm" onClick={()=>selectSession(selected)}><RefreshCw size={14}/> Reload</Button>}</div>
          {selected&&<div className="mt-4 flex flex-wrap items-center gap-2"><Badge>{selected.agentId}</Badge><Badge tone="info">{totalEvents===null?'Loading…':`${totalEvents} events`}</Badge>{coverage&&<Badge tone={coverage.conflictingEvents?'warning':'success'}>{coverage.conflictingEvents} conflicts</Badge>}</div>}
        </div>
        {!selected?<div className="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center"><PlayCircle size={29} className="text-slate-600"/><p className="font-semibold">Select a captured run</p><p className="max-w-xs text-xs leading-6 text-slate-500">Explore model messages, tool inputs and outputs, errors and links to original evidence.</p></div>:
        <>
          {coverage&&<div className="m-4 rounded-lg border border-cyan-500/15 bg-cyan-400/5 px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><ShieldCheck size={14}/> Evidence provenance</div><p className="mt-1 text-xs leading-5 text-slate-400">Observed: {observed.join(', ')||'none'}. Categories not observed remain unverified, not assumed absent.</p></div>}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 pb-4">
            <div className="relative min-w-[180px] flex-1"><Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"/><Input aria-label="Search loaded events" placeholder="Search loaded events…" className="pl-9" value={query} onChange={e=>setQuery(e.target.value)}/></div>
            <Select aria-label="Filter event type" className="w-[150px]" value={kind} onChange={e=>setKind(e.target.value as KindFilter)}><option value="all">All events</option><option value="tool">Tools / MCP</option><option value="conversation">Messages</option><option value="usage">Tokens</option><option value="files">File changes</option><option value="errors">Errors</option></Select>
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {loadingTimeline&&events.length===0?<p className="p-8 text-center text-sm text-slate-400">Reconstructing observed trace…</p>:filtered.length===0?<div className="p-8 text-center text-sm text-slate-500">No events matching this filter in the loaded page.</div>:filtered.map((event,index)=>{
              const Icon=iconByKind[event.kind]??FileText,active=selectedEvent?.eventId===event.eventId;
              return <button key={event.eventId} type="button" onClick={()=>setSelectedEvent(event)} aria-pressed={active} className={cn('group flex w-full items-start gap-3 border-b border-slate-800/70 px-4 py-4 text-left hover:bg-slate-800/35',active&&'bg-cyan-400/8',event.parentEventId&&'pl-8')}>
                <div className="relative flex shrink-0 flex-col items-center"><div className={cn('flex size-9 items-center justify-center rounded-xl border',active?'border-cyan-400/40 bg-cyan-500/15 text-cyan-300':'border-slate-700 bg-slate-800/70 text-slate-400')}><Icon size={16}/></div>{index!==filtered.length-1&&<div className="absolute top-10 h-6 w-px bg-slate-700"/>}</div>
                <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold text-slate-200">{event.summary}</span><Badge tone={toneByKind[event.kind]??'muted'}>{event.kind.replaceAll('_',' ')}</Badge></div>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-slate-400">{truncateText(stringifyContent(event.content),240)}</p>
                  <div className="mt-3 flex flex-wrap gap-2"><span className="text-[11px] text-slate-500">{formatDate(event.occurredAt||event.observedAt)}</span><Badge>{event.evidenceRefs.length} evidence</Badge>{event.parentEventId&&<Badge tone="success">Linked result</Badge>}{event.conflicts.length>0&&<Badge tone="warning">Conflicting</Badge>}</div>
                </div><ChevronRight size={14} className={cn('mt-2 shrink-0',active?'text-cyan-300':'text-slate-600 group-hover:text-slate-300')}/>
              </button>;
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-500"><span>{filtered.length} shown · {events.length} loaded · {totalEvents??0} total</span>{hasMore&&<Button variant="outline" size="sm" disabled={loadingTimeline} onClick={()=>{if(selected&&!loadingMore.current)void fetchPage(selected.sessionId,events.length,requestId.current);}}><ArrowDown size={14}/>{loadingTimeline?'Loading…':'Load more'}</Button>}</div>
        </>}
      </Card>
      <Inspector event={selectedEvent}/>
    </div>}
  </div>;
}
