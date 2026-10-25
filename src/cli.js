#!/usr/bin/env node
import path from 'node:path';
import { importAgent } from './importer.js';
import { createServer } from './server.js';

function parse(argv){
  const args={};
  for(let i=0;i<argv.length;i++){
    if(!argv[i].startsWith('--'))throw Error(`Unexpected argument: ${argv[i]}`);
    const name=argv[i].slice(2);
    if(name==='consent'||name==='help')args[name]=true;
    else{if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error(`Missing value for --${name}`);args[name]=argv[++i];}
  }
  return args;
}
const help=`Agent Trace local-first prototype (Node.js 22+)\n\n  node src/cli.js import --agent codex|claude --root /explicit/agent/sessions --consent [--store .trace-data]\n  node src/cli.js follow --agent codex|claude --root /explicit/agent/sessions --consent [--interval 3000]\n  node src/cli.js serve [--port 4317] [--store .trace-data]\n\n  The --consent flag authorizes reading files in --root. No cloud upload is implemented.\n  The server binds exclusively to 127.0.0.1; recorded content is redacted and encrypted locally.\n`;
async function main(){
  const [cmd,...rest]=process.argv.slice(2);const args=parse(rest);
  if(!cmd||args.help){console.log(help);return;}
  const storeDir=path.resolve(args.store||'.trace-data');
  if(cmd==='serve'){
    const port=args.port===undefined?4317:Number(args.port);
    if(!Number.isSafeInteger(port)||port<0||port>65535)throw Error('Invalid port');
    const server=await createServer({storeDir});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    console.log(`Agent Trace viewer: http://127.0.0.1:${server.address().port}`);
    return;
  }
  if(cmd==='import'||cmd==='follow'){
    const options={agent:args.agent,root:args.root,storeDir,consent:args.consent};
    if(cmd==='import'){console.log(JSON.stringify(await importAgent(options)));return;}
    const interval=args.interval?Number(args.interval):3000;
    if(!Number.isSafeInteger(interval)||interval<500)throw Error('Interval must be >= 500 ms');
    console.log(`Following ${options.agent} transcripts; press Ctrl+C to stop.`);
    while(true){
      try{const r=await importAgent(options);if(r.imported||r.invalid)console.log(JSON.stringify(r));}
      catch(e){console.error('Import error:',e.message);}
      await new Promise(resolve=>setTimeout(resolve,interval));
    }
  }
  throw Error(`Unknown command: ${cmd}\n${help}`);
}
main().catch(e=>{console.error(`Error: ${e.message}`);process.exitCode=1;});
