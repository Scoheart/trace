#!/usr/bin/env node
// Integrated single-port local Next.js + capture API server.
// Web and API always share the same origin, preserving CSRF and Host checks.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import next from 'next';
import {createServer} from '../src/server.js';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const webDir=path.join(repoRoot,'apps','web');
const dev=process.argv.includes('--dev');
const port=Number(process.env.TRACE_PORT||4317);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid TRACE_PORT');
const storeDir=path.resolve(process.env.TRACE_STORE||path.join(repoRoot,'.trace-data'));
const hostname='127.0.0.1';
process.env.NODE_ENV=dev?'development':'production';

const nextApp=next({dir:webDir,dev,hostname,port});
await nextApp.prepare();
const server=await createServer({storeDir,uiHandler:nextApp.getRequestHandler()});
await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,hostname,resolve);
});
console.log(`\nAgent Trace (${dev?'Next.js development':'Next.js production'})\n`+
  `Web + API: http://${hostname}:${port}\n`+
  `Evidence: ${storeDir}\n`+
  `Network access: disabled (loopback only)\n`);

let closing=false;
async function shutdown(){
  if(closing)return;
  closing=true;
  await new Promise(resolve=>server.close(resolve));
  await nextApp.close();
  process.exitCode=0;
}
process.once('SIGINT',()=>{void shutdown()});
process.once('SIGTERM',()=>{void shutdown()});
