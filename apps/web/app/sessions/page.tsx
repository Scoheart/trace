import type {Metadata} from 'next';
import {SessionExplorer} from '../../components/session-explorer';
export const metadata:Metadata={title:'Trace Explorer'};
export default function SessionsPage(){return <SessionExplorer/>;}
