import type {ReactNode} from 'react';
import {Card} from './ui/card';
export function EmptyState({icon,title,description,action}:{icon:ReactNode,title:string,description:string,action?:ReactNode}){
  return <Card className="flex min-h-56 flex-col items-center justify-center gap-3 border-dashed px-8 py-12 text-center">
    <div className="rounded-2xl bg-slate-800/70 p-4 text-cyan-300">{icon}</div>
    <h3 className="font-semibold text-slate-100">{title}</h3>
    <p className="max-w-sm text-sm leading-6 text-slate-400">{description}</p>
    {action}
  </Card>;
}
