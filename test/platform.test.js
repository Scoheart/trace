import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SourceRegistry } from '../src/source-registry.js';
import { CaptureService } from '../src/capture-service.js';
import { createServer } from '../src/server.js';

async function sandbox(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trace-platform-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const input=path.join(dir,'sources'),storeDir=path.join(dir,'data');
  await fs.mkdir(input);
  return {dir,input,storeDir};
}
async function serve(t,storeDir){
  const server=await createServer({storeDir});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve))});
  return `http://127.0.0.1:${server.address().port}`;
}

test('persistent SQLite source registry requires consent and de-duplicates paths',async t=>{
  const {input,storeDir}=await sandbox(t);
  const registry=await SourceRegistry.open(storeDir);
  t.after(()=>registry.close());
  await assert.rejects(registry.add({agent:'codex',root:input,consent:false}),/consent/i);
  const source=await registry.add({agent:'codex',root:input,consent:true,autoScan:true});
  assert.equal(source.agent,'codex');assert.equal(source.autoScan,true);
  await assert.rejects(registry.add({agent:'codex',root:input,consent:true}),/already registered/i);
  const next=await SourceRegistry.open(storeDir);
  assert.equal(next.list().length,1);
  assert.equal(next.get(source.id).id,source.id);
  next.close();
  registry.setAutoScan(source.id,false);
  assert.equal(registry.get(source.id).autoScan,false);
});

test('capture service imports authorized records and records scan results',async t=>{
  const {input,storeDir}=await sandbox(t);
  await fs.writeFile(path.join(input,'demo.jsonl'),JSON.stringify({type:'session_meta',timestamp:'2026-10-24T00:00:00Z',payload:{id:'local-mvp'}})+'\n');
  const registry=await SourceRegistry.open(storeDir);
  t.after(()=>registry.close());
  const entry=await registry.add({agent:'codex',root:input,consent:true});
  const service=new CaptureService({registry,storeDir});
  const first=await service.scan(entry.id);
  assert.equal(first.imported,1);
  assert.equal(registry.get(entry.id).status,'ok');
  assert.equal((await service.scan(entry.id)).imported,0);
  assert.equal(registry.listRuns(entry.id).length,2);
  await service.stop();
});

test('web API manages sources and protects local mutations from CSRF',async t=>{
  const {input,storeDir}=await sandbox(t);
  await fs.writeFile(path.join(input,'demo.jsonl'),JSON.stringify({type:'session_meta',payload:{id:'mvp-2'}})+'\n');
  const base=await serve(t,storeDir);
  const bootstrap=await (await fetch(base+'/api/bootstrap')).json();
  assert.equal(bootstrap.mode,'local');assert.ok(bootstrap.csrfToken.length>20);
  assert.equal((await fetch(base+'/api/sources')).status,200);
  const body=JSON.stringify({agent:'codex',root:input,consent:true,autoScan:false});
  const wrong=await fetch(base+'/api/sources',{method:'POST',headers:{'content-type':'application/json'},body});
  assert.equal(wrong.status,403);
  const headers={'content-type':'application/json','x-trace-csrf':bootstrap.csrfToken,origin:base};
  const forged=await fetch(base+'/api/sources',{method:'POST',headers:{...headers,origin:'https://attacker.invalid'},body});
  assert.equal(forged.status,403);
  const created=await fetch(base+'/api/sources',{method:'POST',headers,body});
  assert.equal(created.status,201);
  const source=await created.json();
  assert.equal(source.agent,'codex');
  const scanned=await fetch(base+`/api/sources/${source.id}/scan`,{method:'POST',headers,body:'{}'});
  assert.equal(scanned.status,200);assert.equal((await scanned.json()).imported,1);
  const sessions=await (await fetch(base+'/api/sessions')).json();
  assert.equal(sessions.length,1);
  const overview=await (await fetch(base+'/api/overview')).json();
  assert.equal(overview.sourceCount,1);assert.equal(overview.sessionCount,1);
});

test('MVP UI exposes a source management panel',async t=>{
  const {storeDir}=await sandbox(t);
  const base=await serve(t,storeDir);
  const html=await (await fetch(base)).text();
  assert.match(html,/sourceManagement/);
  assert.match(html,/Agent Trace/);
});
