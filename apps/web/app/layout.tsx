import type { Metadata } from 'next';
import './globals.css';
import {AppShell} from '../components/app-shell';

export const metadata: Metadata={
  title:{default:'Trace Explorer · Agent Trace',template:'%s · Agent Trace'},
  description:'Local-first coding agent evidence collection and historical trace playback',
  robots:{index:false,follow:false}
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body className="antialiased"><AppShell>{children}</AppShell></body></html>;
}
