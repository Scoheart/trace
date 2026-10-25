import * as React from 'react';
import { cn } from '../../lib/utils';

type Props = React.HTMLAttributes<HTMLSpanElement> & { tone?: 'muted' | 'success' | 'warning' | 'danger' | 'info' };
const tones = {
  muted: 'bg-slate-700/40 border-slate-700 text-slate-300',
  success: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300',
  warning: 'bg-amber-500/10 border-amber-400/30 text-amber-300',
  danger: 'bg-rose-500/10 border-rose-400/30 text-rose-300',
  info: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300',
};
export function Badge({tone='muted',className,...props}:Props){
  return <span className={cn('inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5',tones[tone],className)} {...props}/>;
}
