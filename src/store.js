import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { sha256, parseSourceEnvelope } from './envelope.js';
import { logicalSessionId } from './fusion.js';

async function writeAtomic(filename,buf){
  const temp=filename+'.'+randomBytes(8).toString('hex')+'.tmp';
  try{
    await fs.writeFile(temp,buf,{flag:'wx',mode:0o600});
    await fs.rename(temp,filename);
  }catch(e){await fs.rm(temp,{force:true}).catch(()=>{});throw e;}
}
function encrypt(key,payload){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
  return Buffer.concat([Buffer.from('ATR1'),iv,cipher.getAuthTag(),encrypted]);
}
function decrypt(key,ciphertext){
  if(ciphertext.length<32||ciphertext.subarray(0,4).toString()!=='ATR1')throw Error('Corrupted encrypted evidence');
  const dec=createDecipheriv('aes-256-gcm',key,ciphertext.subarray(4,16));
  dec.setAuthTag(ciphertext.subarray(16,32));
  return Buffer.concat([dec.update(ciphertext.subarray(32)),dec.final()]);
}
export class EvidenceStore {
  constructor(dir,key,state){this.dir=dir;this.key=key;this.state=state;}
  static async open(dir){
    const root=path.resolve(dir);
    await fs.mkdir(root,{recursive:true,mode:0o700});
    await fs.chmod(root,0o700);
    await fs.mkdir(path.join(root,'objects'),{mode:0o700,recursive:true});
    const keyPath=path.join(root,'key.bin');
    let key;
    try{key=await fs.readFile(keyPath);}catch(e){
      if(e.code!=='ENOENT')throw e;
      const candidate=randomBytes(32);
      try{await fs.writeFile(keyPath,candidate,{flag:'wx',mode:0o600});key=candidate;}
      catch(err){if(err.code==='EEXIST')key=await fs.readFile(keyPath);else throw err;}
    }
    if(key.length!==32)throw Error('Invalid key; use a 32-byte local key');
    const statePath=path.join(root,'state.json');
    let state;
    try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}
    catch(e){if(e.code!=='ENOENT')throw e;state={version:1,installationId:randomBytes(16).toString('hex'),evidence:{},checkpoints:{}};await writeAtomic(statePath,JSON.stringify(state));}
    if(state.version!==1||!state.installationId||!state.evidence||!state.checkpoints)throw Error('Invalid trace store');
    return new EvidenceStore(root,key,state);
  }
  async refresh(){
    const state=JSON.parse(await fs.readFile(path.join(this.dir,'state.json'),'utf8'));
    if(state.version!==1||!state.evidence||!state.checkpoints)throw Error('Invalid trace store state');
    this.state=state;
  }
  async lock(){
    const p=path.join(this.dir,'import.lock');
    let f;
    try{f=await fs.open(p,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Another import is running for this store');throw e;}
    await f.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
    return async()=>{await f.close();await fs.rm(p,{force:true});};
  }
  getCheckpoint(key){return this.state.checkpoints[key];}
  listEvidence(){return Object.values(this.state.evidence).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.sourceByteOffset-b.sourceByteOffset);}
  listSessions(){
    const groups=new Map();
    for(const e of this.listEvidence()){
      const sessionId=logicalSessionId(e);
      if(!groups.has(sessionId))groups.set(sessionId,{sessionId,agentId:e.agentId,nativeSessionId:e.sourceNativeSessionId||null,records:0,startedAt:e.observedAt,lastObservedAt:e.observedAt});
      const group=groups.get(sessionId);group.records++;group.lastObservedAt=e.observedAt;
      if(!group.nativeSessionId&&e.sourceNativeSessionId)group.nativeSessionId=e.sourceNativeSessionId;
    }
    return [...groups.values()].sort((a,b)=>b.lastObservedAt.localeCompare(a.lastObservedAt));
  }
  async putBatch(envelopes,checkpoints){
    const toIndex={};
    for(const envelope of envelopes){
      parseSourceEnvelope(envelope);
      const existing=this.state.evidence[envelope.evidenceId];
      if(existing){if(existing.payloadSha256!==envelope.payloadSha256)throw Error('Evidence ID collision');continue;}
      const plaintext=Buffer.from(envelope.payloadBase64,'base64');
      const blobPath=path.join(this.dir,'objects',envelope.evidenceId+'.bin');
      await writeAtomic(blobPath,encrypt(this.key,plaintext));
      const {payloadBase64,...metadata}=envelope;
      toIndex[envelope.evidenceId]=metadata;
    }
    const next={...this.state,evidence:{...this.state.evidence,...toIndex},checkpoints:{...this.state.checkpoints,...checkpoints}};
    await writeAtomic(path.join(this.dir,'state.json'),JSON.stringify(next));
    this.state=next;
    return Object.keys(toIndex).length;
  }
  async getPayload(evidenceId){
    if(!/^[a-f0-9]{64}$/.test(evidenceId))throw Error('Invalid evidence ID');
    const item=this.state.evidence[evidenceId];if(!item)return null;
    const encrypted=await fs.readFile(path.join(this.dir,'objects',evidenceId+'.bin'));
    const payload=decrypt(this.key,encrypted);
    if(sha256(payload)!==item.payloadSha256)throw Error('Evidence integrity failure');
    return payload;
  }
}
