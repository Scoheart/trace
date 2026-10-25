import fs from 'node:fs/promises';
import path from 'node:path';
import { EvidenceStore } from './store.js';
import { discoverJsonl,readJsonlDelta } from './jsonl.js';
import { sanitizeRecord } from './redact.js';
import { sha256, makeEvidenceId } from './envelope.js';

function nativeSession(agent,obj){
  if(!obj||typeof obj!=='object')return null;
  if(agent==='codex'&&obj.type==='session_meta'&&typeof obj.payload?.id==='string')return obj.payload.id;
  if(agent==='claude'&&typeof obj.sessionId==='string')return obj.sessionId;
  return null;
}

/** Explicit consent + root are mandatory; no background scanning of the user's home. */
export async function importAgent({agent,root,storeDir,consent=false,batchSize=1000}){
  if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>5000)throw Error('batchSize must be 1..5000');
  if(!consent)throw Error('Explicit consent is required before scanning Agent transcripts');
  if(!['codex','claude'].includes(agent))throw Error('Only codex and claude adapters are implemented');
  if(!root||!storeDir)throw Error('Specify --root and --store');
  const approved=await fs.realpath(root);
  const store=await EvidenceStore.open(storeDir);
  const storeReal=await fs.realpath(storeDir);
  if(storeReal===approved||storeReal.startsWith(approved+path.sep))throw Error('Store must be outside the authorized source root');
  const unlock=await store.lock();
  try{
    const files=await discoverJsonl(approved);
    const consentId=sha256(`approved\0${store.state.installationId}\0${agent}\0${approved}`);
    let imported=0,invalid=0,partial=0;
    for(const file of files){
      const cpKey=sha256(`${agent}\0${file}`);
      let cp=store.getCheckpoint(cpKey);
      while(true){
      const delta=await readJsonlDelta(file,cp,{maxRecords:batchSize});
      if(delta.pendingPartialLine)partial++;
      let sessionNative=delta.next.fileGenerationId===cp?.fileGenerationId?cp?.nativeSessionId:null;
      const envelopes=[];
      for(const record of delta.records){
        // Extract only permitted session metadata; raw content gets sanitized before persistence.
        sessionNative=nativeSession(agent,record.parsed)||sessionNative;
        const sanitized=sanitizeRecord(record.rawBytes);
        const hash=sha256(sanitized.retainedBytes);
        const sessionId=sha256(`${store.state.installationId}\0${agent}\0${delta.next.fileGenerationId}`);
        const body={schemaVersion:1,installationId:store.state.installationId,agentId:agent,adapterId:`${agent}-local-jsonl`,adapterVersion:'0.1.0',sourceKind:'transcript_file',sourceNativeSessionId:sessionNative||undefined,sourceRecordId:`${record.byteOffset}`,sourceFileGenerationId:delta.next.fileGenerationId,sourceByteOffset:record.byteOffset,payloadSha256:hash,payloadBase64:sanitized.retainedBytes.toString('base64'),transformFlags:sanitized.transformFlags,consentId,observedAt:new Date().toISOString(),occurredAt:typeof record.parsed?.timestamp==='string'?record.parsed.timestamp:undefined,sessionId,sourceName:path.relative(approved,file),parseStatus:record.parseStatus};
        body.evidenceId=makeEvidenceId(body);
        envelopes.push(body);
        if(record.parseStatus==='invalid_json')invalid++;
      }
      // Durable blobs and index persist before checkpoint. Restarts retry safely.
      const nextCp={...delta.next,nativeSessionId:sessionNative||undefined};
      imported+=await store.putBatch(envelopes,{[cpKey]:nextCp});
      cp=nextCp;
      if(!delta.hasMore||delta.records.length===0)break;
      }
    }
    return {agent,discovered:files.length,imported,invalid,partial};
  }finally{await unlock();}
}
