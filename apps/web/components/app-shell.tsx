'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Database, ExternalLink, Layers3, LockKeyhole, RadioTower, Terminal, Workflow } from 'lucide-react';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';

const nav=[
  {href:'/sessions',title:'Trace explorer',subtitle:'Playback & evidence',icon:Workflow},
  {href:'/sources',title:'Data sources',subtitle:'Collectors & scanning',icon:Database}
];

export function AppShell({children}:{children:React.ReactNode}){
  const pathname=usePathname();
  return <div className="min-h-screen bg-[#0c121c] text-slate-100">
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="sticky top-0 z-20 w-full shrink-0 border-b border-slate-800 bg-[#101824] md:h-screen md:w-[258px] md:border-r md:border-b-0">
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-800/80 px-5">
          <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"><Layers3 size={21}/></div>
          <div className="min-w-0 flex-1"><div className="font-bold tracking-[.12em]">TRACE</div><div className="text-[10px] font-medium tracking-[.14em] text-slate-500">AGENT OBSERVABILITY</div></div>
          <Badge tone="info" className="!px-1.5">MVP</Badge>
        </div>
        <div className="hidden px-5 pt-8 pb-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500 md:block">Workspace</div>
        <nav aria-label="Main navigation" className="flex gap-2 px-3 py-3 md:flex-col md:gap-1 md:py-0">
          {nav.map(item=>{
            const Icon=item.icon,active=pathname===item.href||(pathname==='/'&&item.href==='/sessions');
            return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={cn(
              'flex flex-1 items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-sm transition-colors md:flex-none',
              active?'border-cyan-500/20 bg-cyan-400/10 text-cyan-300':'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100')}
            >
              <Icon size={18} className="shrink-0"/>
              <span className="truncate"><span className="block font-semibold">{item.title}</span><span className="hidden text-xs text-slate-500 md:block">{item.subtitle}</span></span>
            </Link>;
          })}
        </nav>
        <div className="mx-5 mt-8 hidden rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:block">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><span className="size-2 animate-pulse rounded-full bg-emerald-400"/> Local mode</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Evidence is processed and stored on this machine. No cloud upload.</p>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-3 text-[11px] text-slate-400"><LockKeyhole size={13}/> AES-GCM encrypted</div>
        </div>
        <div className="hidden md:absolute md:right-0 md:bottom-0 md:left-0 md:block md:border-t md:border-slate-800 md:px-5 md:py-5">
          <a href="https://github.com/Scoheart/trace" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-200"><ExternalLink size={15}/> Scoheart/trace</a>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-800 px-5 md:px-8">
          <div className="flex items-center gap-2 text-xs text-slate-400"><Terminal size={16} className="text-cyan-400"/><span className="hidden sm:inline">Agent Trace Platform</span><span className="text-slate-600">/</span><span className="font-medium text-slate-200">{pathname==='/sources'?'Data sources':'Trace explorer'}</span></div>
          <div className="flex items-center gap-3"><Badge tone="success"><RadioTower className="mr-1.5 size-3"/> 127.0.0.1</Badge><div className="hidden text-xs text-slate-500 sm:flex sm:items-center sm:gap-2"><Activity size={14}/> Capture & inspect</div></div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">{children}</main>
        <footer className="border-t border-slate-800 px-6 py-4 text-[11px] text-slate-600">Read-only historical playback · Captured evidence only · Never reconstructs unavailable agent internals.</footer>
      </div>
    </div>
  </div>;
}
