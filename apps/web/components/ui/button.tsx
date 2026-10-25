import * as React from 'react';
import { cn } from '../../lib/utils';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'icon';
};
const variants = {
  primary: 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 border-cyan-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/80 border-transparent',
  outline: 'bg-transparent text-slate-200 hover:bg-slate-800 border-slate-700',
  danger: 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20',
};
const sizes = {sm:'h-8 px-3 text-xs',md:'h-10 px-4 text-sm',icon:'h-9 w-9 p-0'};
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button({
  className, variant = 'secondary', size = 'md', type='button', ...props
}, ref) {
  return <button ref={ref} type={type} className={cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-40',
    variants[variant], sizes[size], className
  )} {...props} />;
});
