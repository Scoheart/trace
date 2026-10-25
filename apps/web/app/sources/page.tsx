import type {Metadata} from 'next';
import {SourceManager} from '../../components/source-manager';
export const metadata:Metadata={title:'Data Sources'};
export default function SourcesPage(){return <SourceManager/>;}
