import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createServer } from '../src/server.js';

const setup=async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'trace-framework-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  return dir;
};

test('framework handler gets non-API routes while native APIs remain intact',async t=>{
  const storeDir=await setup(t);
  const routed=[];
  const handler=async (req,res)=>{
    routed.push(req.url);
    res.writeHead(200,{'content-type':'text/plain'});res.end('next framework');
  };
  const server=await createServer({storeDir,uiHandler:handler});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const page of ['/','/sessions','/sources','/_next/static/test.js']){
    const response=await fetch(base+page);
    assert.equal(response.status,200);
    assert.equal(await response.text(),'next framework');
  }
  const health=await (await fetch(base+'/api/health')).json();
  assert.equal(health.mode,'local');
  assert.deepEqual(routed,['/','/sessions','/sources','/_next/static/test.js']);
});

test('framework handler cannot bypass local host check',async t=>{
  const storeDir=await setup(t);
  let called=false;
  const server=await createServer({storeDir,uiHandler:async()=>{called=true;}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/sessions',headers:{host:'attacker.invalid'}},res=>{res.resume();resolve(res);});
    req.on('error',reject);req.end();
  });
  assert.equal(response.statusCode,403);
  assert.equal(called,false);
});
