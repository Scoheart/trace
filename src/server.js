import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvidenceStore } from './store.js';
import { projectEvent } from './project.js';
import { evidenceToClaims, fuseClaims, logicalSessionId, timelineCoverage } from './fusion.js';

const publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const STATIC={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/viewer-model.js':['viewer-model.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8']};
function respond(res,status,content,type='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
  res.end(type.startsWith('application/json')?JSON.stringify(content):content);
}
export async function createServer({storeDir}) {
  const store=await EvidenceStore.open(storeDir);
  return http.createServer(async(req,res)=>{
    try{
      const host=String(req.headers.host||'').toLowerCase().split(':')[0];
      if(host!=='127.0.0.1'&&host!=='localhost')return respond(res,403,{error:'Untrusted Host header'});
      if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
      await store.refresh();
      const url=new URL(req.url||'/', 'http://localhost');
      const pathname=url.pathname;
      if(STATIC[pathname]){
        const [file,type]=STATIC[pathname];
        return respond(res,200,await fs.readFile(path.join(publicDir,file)),type);
      }
      if(pathname==='/api/sessions')return respond(res,200,store.listSessions());
      const timeline=pathname.match(/^\/api\/sessions\/([a-f0-9]{64})\/timeline$/);
      if(timeline) {
        const evidence=store.listEvidence().filter(e=>logicalSessionId(e)===timeline[1]);
        if(!evidence.length)return respond(res,404,{error:'Session not found'});
        // Fail visibly rather than pretending a truncated replay is complete.
        if(evidence.length>2500)return respond(res,413,{error:"Session exceeds this prototype's 2,500-record fusion limit",rawEvidenceCount:evidence.length});
        const offset=Math.min(1000000,Math.max(0,Number.parseInt(url.searchParams.get('offset')||'0',10)||0));
        const limit=Math.min(250,Math.max(1,Number.parseInt(url.searchParams.get('limit')||'100',10)||100));
        let bytesRead=0,invalidRecords=0;
        const claims=[];
        for(const entry of evidence) {
          const raw=await store.getPayload(entry.evidenceId);
          bytesRead+=raw.byteLength;
          if(bytesRead>128*1024*1024)return respond(res,413,{error:"Session exceeds this prototype's 128-MiB fusion memory limit"});
          let source;
          try{source=JSON.parse(raw.toString('utf8'));}
          catch{source={type:'invalid_json',rawText:raw.toString('utf8')};}
          if(entry.parseStatus==='invalid_json')invalidRecords++;
          claims.push(...evidenceToClaims(entry,source));
        }
        const {events,unmergedClaims}=fuseClaims(claims);
        return respond(res,200,{sessionId:timeline[1],fusionVersion:1,rawEvidenceCount:evidence.length,
          totalEvents:events.length,unmergedClaims,offset,limit,hasMore:offset+limit<events.length,
          coverage:timelineCoverage(events,{rawRecordCount:evidence.length,invalidRecords}),
          events:events.slice(offset,offset+limit)});
      }
      const session=pathname.match(/^\/api\/sessions\/([a-f0-9]{64})$/);
      if(session){
        const evidence=store.listEvidence().filter(e=>logicalSessionId(e)===session[1]);
        if(!evidence.length)return respond(res,404,{error:'Session not found'});
        const offset=Math.min(1000000,Math.max(0,Number.parseInt(url.searchParams.get('offset')||'0',10)||0));
        const limit=Math.min(300,Math.max(1,Number.parseInt(url.searchParams.get('limit')||'200',10)||200));
        const rows=[];
        for(const entry of evidence.slice(offset,offset+limit)){
          const raw=await store.getPayload(entry.evidenceId);
          let source;
          try{source=JSON.parse(raw.toString('utf8'));}catch{source={type:'invalid_json',rawText:raw.toString('utf8')};}
          const derived=entry.parseStatus==='invalid_json'?[{kind:'invalid_json',summary:'Malformed JSONL record',content:source.rawText??source}]:projectEvent(entry.agentId,source);
          for(const [index,event] of derived.entries())rows.push({eventId:`${entry.evidenceId}:${index}`,evidenceId:entry.evidenceId,agentId:entry.agentId,sourceName:entry.sourceName,sourceByteOffset:entry.sourceByteOffset,occurredAt:entry.occurredAt??null,observedAt:entry.observedAt,transformFlags:entry.transformFlags,...event});
        }
        return respond(res,200,{sessionId:session[1],totalEvidence:evidence.length,offset,limit,hasMore:offset+limit<evidence.length,events:rows});
      }
      const evidence=pathname.match(/^\/api\/evidence\/([a-f0-9]{64})$/);
      if(evidence){
        const meta=store.state.evidence[evidence[1]];
        if(!meta)return respond(res,404,{error:'Evidence not found'});
        const bytes=await store.getPayload(evidence[1]);
        return respond(res,200,{metadata:meta,retainedText:bytes.toString('utf8'),hashVerified:true});
      }
      return respond(res,404,{error:'Not found'});
    }catch(e){
      console.error('[trace-server]',e?.message||'Internal server error');
      return respond(res,500,{error:'Failed to retrieve evidence'});
    }
  });
}
