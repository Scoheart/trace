'use client';

import {FormEvent,useCallback,useEffect,useRef,useState} from 'react';
import {Activity,AlertCircle,Check,Clock3,Database,FolderOpen,HardDrive,LockKeyhole,PauseCircle,PlayCircle,Plus,RefreshCw,ShieldCheck,Trash2,Workflow} from 'lucide-react';
import {getJSON,mutateJSON,formatDate} from '../lib/api';
import type {Bootstrap,LocalSource,Overview,ScanResult} from '../lib/types';
import {Button} from './ui/button';
import {Badge} from './ui/badge';
import {Card,CardHeader,CardTitle} from './ui/card';
import {Input,Select} from './ui/form-controls';
import {EmptyState} from './empty-state';

type Notice={message:string,type:'success'|'error'};
function Stat({title,value,icon:Icon}:{title:string,value:number|string,icon:typeof Database}){
  return <Card className="flex items-start gap-4 p-5"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/15 bg-cyan-500/10 text-cyan-300"><Icon size={19}/></div><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{title}</p><div className="mt-1 text-2xl font-bold tabular-nums">{value}</div></div></Card>;
}
export function SourceManager(){
  const [bootstrap,setBootstrap]=useState<Bootstrap|null>(null);
  const [overview,setOverview]=useState<Overview|null>(null);
  const [sources,setSources]=useState<LocalSource[]>([]);
  const [agent,setAgent]=useState<'codex'|'claude'>('codex');
  const [root,setRoot]=useState('');
  const [autoScan,setAutoScan]=useState(true);
  const [consent,setConsent]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [pending,setPending]=useState<Record<string,boolean>>({});
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState<Notice|null>(null);
  const previousLoad=useRef(0);
  const csrf=bootstrap?.csrfToken||'';

  const refresh=useCallback(async ()=>{
    const iteration=++previousLoad.current;
    try{
      const [stats,items]=await Promise.all([getJSON<Overview>('/api/overview'),getJSON<LocalSource[]>('/api/sources')]);
      if(previousLoad.current!==iteration)return;
      setOverview(stats);setSources(items);
    }catch(e){if(previousLoad.current===iteration)setNotice({type:'error',message:e instanceof Error?e.message:'Could not reach local API'});}
    finally{if(previousLoad.current===iteration)setLoading(false);}
  },[]);
  useEffect(()=>{
    let active=true;
    void getJSON<Bootstrap>('/api/bootstrap').then(data=>{if(active)setBootstrap(data);}).catch(e=>{if(active)setNotice({type:'error',message:e instanceof Error?e.message:'Could not initialize local API'});});
    void refresh();
    const ticker=setInterval(()=>{if(!document.hidden)void refresh();},7000);
    return ()=>{active=false;clearInterval(ticker);previousLoad.current++;};
  },[refresh]);

  async function addSource(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!consent){setNotice({type:'error',message:'Explicit directory authorization is required.'});return;}
    if(!csrf){setNotice({type:'error',message:'Local API has not initialized.'});return;}
    setSubmitting(true);setNotice(null);
    try{
      const source=await mutateJSON<LocalSource>('/api/sources','POST',csrf,{agent,root:root.trim(),autoScan,consent:true});
      const result=await mutateJSON<ScanResult>(`/api/sources/${source.id}/scan`,'POST',csrf);
      setNotice({type:'success',message:`${agent.toUpperCase()} connected. Imported ${result.imported} historical record(s).`});
      setRoot('');setConsent(false);await refresh();
    }catch(e){setNotice({type:'error',message:e instanceof Error?e.message:'Could not register directory'});await refresh();}
    finally{setSubmitting(false);}
  }

  async function performAction(id:string,task:()=>Promise<string>){
    if(!csrf)return;
    setPending(prev=>({...prev,[id]:true}));setNotice(null);
    try{const message=await task();setNotice({type:'success',message});await refresh();}
    catch(e){setNotice({type:'error',message:e instanceof Error?e.message:'Collector action failed'});}
    finally{setPending(prev=>({...prev,[id]:false}));}
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-cyan-400"><Activity size={13}/> Capture Engine / Local</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Data sources</h1><p className="mt-2 text-sm text-slate-400">Manage your Agent transcript collectors and bring historical runs into the Trace Explorer.</p></div><div className="flex items-center gap-2"><Badge tone="success"><LockKeyhole size={12} className="mr-1"/> On-device storage</Badge><Button size="sm" variant="outline" onClick={()=>refresh()}><RefreshCw size={14}/> Refresh</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat title="Sessions" value={overview?.sessionCount??'—'} icon={Workflow}/>
      <Stat title="Evidence records" value={overview?.evidenceCount??'—'} icon={HardDrive}/>
      <Stat title="Connected sources" value={overview?.sourceCount??'—'} icon={Database}/>
      <Stat title="Auto-following" value={overview?.runningSources??'—'} icon={Activity}/>
    </div>
    {notice&&<div role="alert" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${notice.type==='error'?'border-rose-500/30 bg-rose-500/10 text-rose-200':'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{notice.type==='error'?<AlertCircle size={18}/>:<Check size={18}/>}<span>{notice.message}</span></div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-cyan-400"><Plus size={13}/> New collector</div><CardTitle className="text-lg">Connect an Agent</CardTitle><p className="mt-1 text-xs leading-5 text-slate-400">Select an Agent and explicitly authorize one local JSONL directory. No other folders are scanned.</p></CardHeader>
        <form onSubmit={addSource} className="space-y-5 px-5 pb-6">
          <div className="space-y-2"><label htmlFor="agent" className="text-xs font-semibold text-slate-300">Agent provider</label><Select id="agent" value={agent} onChange={e=>setAgent(e.target.value as typeof agent)}><option value="codex">Codex CLI</option><option value="claude">Claude Code</option></Select></div>
          <div className="space-y-2"><label htmlFor="root" className="text-xs font-semibold text-slate-300">Authorized local directory</label><div className="relative"><FolderOpen size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"/><Input required id="root" className="pl-10 font-mono text-xs" value={root} onChange={e=>setRoot(e.target.value)} placeholder={agent==='codex'?'/Users/you/.codex/sessions':'/Users/you/.claude/projects'} spellCheck={false} autoComplete="off"/></div><p className="text-[11px] leading-5 text-slate-500">Use an absolute path. The process must have permission to read this folder.</p></div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300"><input type="checkbox" checked={autoScan} onChange={e=>setAutoScan(e.target.checked)} className="size-4 accent-cyan-400"/><span><strong className="block font-semibold text-slate-200">Automatically follow new records</strong><span className="mt-1 block text-slate-500">Periodically scan this directory while the local service runs</span></span></label>
          <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-300"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-cyan-400"/><span>I authorize reading transcripts in this directory, including messages, code and tool output.</span></label>
          <Button type="submit" variant="primary" className="w-full" disabled={submitting||!bootstrap||!consent||!root.trim()}>{submitting?<RefreshCw size={16} className="animate-spin"/>:<Plus size={16}/>} {submitting?'Connecting…':'Connect & import history'}</Button>
        </form>
      </Card>
      <Card className="min-w-0 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-cyan-400">Registered collectors</p><h2 className="mt-1 text-lg font-semibold">Your connected sources</h2></div><Badge>{sources.length} sources</Badge></div>
        <div className="space-y-3 p-4 sm:p-5">
          {loading?<p className="py-8 text-center text-sm text-slate-500">Loading collector registry…</p>:sources.length===0?<EmptyState icon={<Database size={24}/>} title="No sources connected" description="Add a local Codex or Claude Code transcript folder. Previous records will be imported immediately."/>:
            sources.map(source=><div key={source.id} className="rounded-xl border border-slate-800 bg-[#0e1622] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300"><Workflow size={17}/></div><div><h3 className="text-sm font-semibold">{source.agent==='codex'?'Codex CLI':'Claude Code'}</h3><p className="text-[11px] text-slate-500">Local JSONL collector</p></div></div><Badge tone={source.status==='error'?'danger':source.autoScan?'success':'muted'}>{source.status==='error'?'Error':source.autoScan?'Auto-follow':'Manual'}</Badge></div>
              <div className="mt-4 break-all rounded-md border border-slate-800/80 bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300">{source.root}</div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 size={12}/>{source.lastScanAt?`Scanned ${formatDate(source.lastScanAt)} · +${source.lastImported} records`:'Not scanned yet'}</p>
              {source.lastError&&<p className="mt-2 break-words text-xs text-rose-300">{source.lastError}</p>}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <Button size="sm" variant="outline" disabled={pending[source.id]} onClick={()=>performAction(source.id,async()=>{const result=await mutateJSON<ScanResult>(`/api/sources/${source.id}/scan`,'POST',csrf);return `Scanned ${source.agent}; ${result.imported} new records imported.`;})}><RefreshCw size={13} className={pending[source.id]?'animate-spin':''}/> Scan now</Button>
                <Button size="sm" variant="outline" disabled={pending[source.id]} onClick={()=>performAction(source.id,async()=>{await mutateJSON(`/api/sources/${source.id}`,'PATCH',csrf,{autoScan:!source.autoScan});return source.autoScan?'Automatic scanning paused.':'Automatic scanning enabled.';})}>{source.autoScan?<PauseCircle size={13}/>:<PlayCircle size={13}/>} {source.autoScan?'Pause':'Enable'} follow</Button>
                <Button size="sm" variant="danger" className="sm:ml-auto" disabled={pending[source.id]} onClick={()=>{if(window.confirm('Remove this source? Previously captured evidence will remain on this device.'))void performAction(source.id,async()=>{await mutateJSON(`/api/sources/${source.id}`,'DELETE',csrf);return 'Collector removed; encrypted evidence retained.';});}}><Trash2 size={13}/> Remove</Button>
              </div>
            </div>)}
        </div>
      </Card>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {[{icon:ShieldCheck,title:'Evidence-first',body:'Records are sanitized then encrypted locally before they are indexed for historical playback.'},{icon:LockKeyhole,title:'Consent driven',body:'You authorize exactly which folders to read. Removing a source never deletes prior evidence.'},{icon:Activity,title:'Honest coverage',body:'Unobserved agent internals are marked unverified. No false completeness scores.'}].map(item=>{
        const Icon=item.icon;
        return <Card key={item.title} className="flex gap-3 px-4 py-4"><Icon size={18} className="mt-1 shrink-0 text-cyan-300"/><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p></div></Card>;
      })}
    </div>
  </div>;
}
