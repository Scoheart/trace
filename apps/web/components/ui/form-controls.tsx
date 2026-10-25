import * as React from 'react';
import { cn } from '../../lib/utils';
export const Input=React.forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({className,...props},ref){return <input ref={ref} className={cn('h-10 w-full rounded-lg border border-slate-700 bg-[#0e1622] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:opacity-50',className)} {...props}/>;}
);
export const Select=React.forwardRef<HTMLSelectElement,React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({className,...props},ref){return <select ref={ref} className={cn('h-10 w-full rounded-lg border border-slate-700 bg-[#0e1622] px-3 text-sm text-slate-100 outline-none focus:border-cyan-500',className)} {...props}/>;}
);
