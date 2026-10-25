import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { SourceRegistry } from './source-registry.js';
import { CaptureService } from './capture-service.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvidenceStore } from './store.js';
import { projectEvent } from './project.js';
import { evidenceToClaims, fuseClaims, logicalSessionId, timelineCoverage } from './fusion.js';

const publicDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const STATIC={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/viewer-model.js':['viewer-model.js','text/javascript; charset=utf-8'],'/styles.css':['styles.css','text/css; charset=utf-8'],'/sources.js':['sources.js','text/javascript; charset=utf-8']};
function respond(res,status,content,type='application/json; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});
  res.end(type.startsWith('application/json')?JSON.stringify(content):content);
}
function isSameOrigin(req, token) {
  const host=String(req.headers.host||'');
  const origin=req.headers.origin;
  const expected=new Set([`http://${host}`]);
  const supplied=req.headers['x-trace-csrf'];
  if(typeof supplied!=='string')return false;
  const a=Buffer.from(supplied),b=Buffer.from(token);
  return a.length===b.length&&timingSafeEqual(a,b) && (!origin||expected.has(origin));
}
async function receiveJSON(req) {
  const type=String(req.headers['content-type']||'').split(';')[0];
  if(type!=='application/json')throw new Error('Content-Type must be application/json');
  const chunks=[];let bytes=0;
  for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>16*1024)throw new Error('Request body too large');
    chunks.push(chunk);
  }
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Expected JSON object');
  return data;
}
export async function createServer({storeDir,scanIntervalMs=5000}) {
  const store=await EvidenceStore.open(storeDir);
  const registry=await SourceRegistry.open(storeDir);
  const capture=new CaptureService({registry,storeDir,intervalMs:scanIntervalMs});
  const csrfToken=randomBytes(32).toString('base64url');
  const server=http.createServer(async(req,res)=>{
    try{
      const host=String(req.headers.host||'').toLowerCase().split(':')[0];
      if(host!=='127.0.0.1'&&host!=='localhost')return respond(res,403,{error:'Untrusted Host header'});
      const url=new URL(req.url||'/', 'http://localhost');
      const pathname=url.pathname;
      const isWrite=['POST','PATCH','DELETE'].includes(req.method);
      const mutablePath=pathname==='/api/sources'||/^\/api\/sources\/[a-f0-9-]{36}(?:\/scan)?$/.test(pathname);
      if(isWrite&&!mutablePath)return respond(res,405,{error:'Method not allowed'});
      if(isWrite&&!isSameOrigin(req,csrfToken))return respond(res,403,{error:'CSRF protection: open the local UI first'});
      if(!isWrite&&req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
      await store.refresh();
      if(req.method==='GET'&&STATIC[pathname]){
        const [file,type]=STATIC[pathname];
        return respond(res,200,await fs.readFile(path.join(publicDir,file)),type);
      }
      if(pathname==='/api/bootstrap'&&req.method==='GET')return respond(res,200,{mode:'local',csrfToken,supportedAgents:['codex','claude'],cloudEnabled:false,version:'0.2.0'});
      if(pathname==='/api/health'&&req.method==='GET')return respond(res,200,{ok:true,mode:'local'});
      if(pathname==='/api/overview'&&req.method==='GET'){
        const sessions=store.listSessions();
        const sources=registry.list();
        return respond(res,200,{mode:'local',sessionCount:sessions.length,evidenceCount:store.listEvidence().length,sourceCount:sources.length,
          runningSources:sources.filter(s=>s.autoScan).length,agents:[...new Set(sessions.map(s=>s.agentId))],errors:sources.filter(s=>s.status==='error').length});
      }
      if(pathname==='/api/sources'){
        if(req.method==='GET')return respond(res,200,registry.list());
        if(req.method==='POST'){
          let payload;
          try{payload=await receiveJSON(req);}catch(e){return respond(res,400,{error:e.message});}
          try{const source=await registry.add(payload);return respond(res,201,source);}
          catch(e){return respond(res,/already registered/i.test(e.message)?409:400,{error:e.message});}
        }
        return respond(res,405,{error:'Method not allowed'});
      }
      const source=pathname.match(/^\/api\/sources\/([a-f0-9-]{36})(?:\/(scan|runs))?$/);
      if(source){
        const [,id,action]=source;
        if(!registry.get(id))return respond(res,404,{error:'Source not found'});
        if(action==='runs'&&req.method==='GET')return respond(res,200,registry.listRuns(id));
        if(action==='scan'&&req.method==='POST'){
          try{await receiveJSON(req);}catch(e){return respond(res,400,{error:e.message});}
          try{return respond(res,200,await capture.scan(id));}
          catch(e){return respond(res,422,{error:e.message});}
        }
        if(!action&&req.method==='PATCH'){
          try{const data=await receiveJSON(req);
            if(typeof data.autoScan!=='boolean')return respond(res,400,{error:'autoScan must be a boolean'});
            return respond(res,200,registry.setAutoScan(id,data.autoScan));}
          catch(e){return respond(res,400,{error:e.message});}
        }
        if(!action&&req.method==='DELETE'){registry.remove(id);return respond(res,200,{removed:true,evidenceRetained:true});}
        return respond(res,405,{error:'Method not allowed'});
      }
      if(pathname==='/api/sessions'&&req.method==='GET')return respond(res,200,store.listSessions());
      if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
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
  server.on('close',()=>{capture.stop().finally(()=>registry.close()).catch(err=>console.error('[trace-server] close:',err.message));});
  capture.start();
  return server;
}
