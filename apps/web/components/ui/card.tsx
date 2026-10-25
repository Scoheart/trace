import * as React from 'react';
import { cn } from '../../lib/utils';

export function Card({className,...props}:React.HTMLAttributes<HTMLDivElement>){
  return <div className={cn('rounded-xl border border-slate-800/80 bg-[#141c28] shadow-[0_8px_32px_-14px_rgba(0,0,0,.3)]',className)} {...props}/>;
}
export function CardHeader({className,...props}:React.HTMLAttributes<HTMLDivElement>){
  return <div className={cn('flex flex-col gap-1 px-5 pt-5 pb-3',className)} {...props}/>;
}
export function CardTitle({className,...props}:React.HTMLAttributes<HTMLHeadingElement>){
  return <h2 className={cn('text-sm font-semibold tracking-tight text-slate-100',className)} {...props}/>;
}
