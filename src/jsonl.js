import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { sha256 } from './envelope.js';

const MAX_RECORD_BYTES = 16 * 1024 * 1024;

/** Never follow symlinks inside an approved root. */
export async function discoverJsonl(root) {
  const approved=await fs.realpath(root);
  const rootStat=await fs.stat(approved);
  if(!rootStat.isDirectory()) throw new Error('Approved root must be a directory');
  const found=[];
  async function walk(dir) {
    for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
      if(entry.isSymbolicLink()) continue;
      const abs=path.join(dir,entry.name);
      if(entry.isDirectory()) await walk(abs);
      else if(entry.isFile()&&entry.name.endsWith('.jsonl')) found.push(abs);
    }
  }
  await walk(approved);
  return found.sort();
}

/** Reads only newline-terminated raw records. UTF-8 byte offsets survive emoji and CRLF. */
export async function readJsonlDelta(filename, checkpoint, {maxRecords=1000}={}) {
  if(!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>5000)throw Error('maxRecords must be 1..5000');
  const statBefore=await fs.lstat(filename);
  if(!statBefore.isFile()||statBefore.isSymbolicLink()) throw new Error('Not a safe regular JSONL file');
  const fd=await fs.open(filename,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat=await fd.stat();
    if(!stat.isFile()) throw new Error('Non-regular source');
    const prefixBuf=Buffer.alloc(Math.min(64,stat.size));
    if(prefixBuf.length) await fd.read(prefixBuf,0,prefixBuf.length,0);
    const prefix=prefixBuf.toString('base64');
    const identity=`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`;
    const prevPrefix=checkpoint?.firstBytes ? Buffer.from(checkpoint.firstBytes,'base64') : null;
    const prefixChanged=prevPrefix&&!prefixBuf.subarray(0,prevPrefix.length).equals(prevPrefix.subarray(0,prefixBuf.length));
    const fresh=!checkpoint||checkpoint.fileIdentity!==identity||stat.size<checkpoint.byteOffset||prefixChanged;
    const generation=fresh?(checkpoint?.generationCounter??-1)+1:(checkpoint.generationCounter??0);
    const fileGenerationId=sha256(`${filename}\u0000${identity}\u0000${generation}`);
    let baseOffset=fresh?0:checkpoint.byteOffset;
    let pos=baseOffset;
    let partial=Buffer.alloc(0);
    let partialStart=baseOffset;
    const records=[];
    const buf=Buffer.alloc(128*1024);
    readChunks: while(true){
      const {bytesRead}=await fd.read(buf,0,buf.length,pos);
      if(!bytesRead)break;
      let current=0;
      for(let i=0;i<bytesRead;i++){
        if(buf[i]!==10)continue;
        const chunk=buf.subarray(current,i);
        const rawBytes=partial.length?Buffer.concat([partial,chunk]):Buffer.from(chunk);
        if(rawBytes.length>MAX_RECORD_BYTES) throw new Error('JSONL line exceeds 16 MiB; checkpoint unchanged');
        let parsed,parseStatus='ok';
        try{parsed=JSON.parse(rawBytes.toString('utf8'));}catch{parseStatus='invalid_json';}
        records.push({byteOffset:partialStart,rawBytes,parseStatus,parsed});
        partial=Buffer.alloc(0);partialStart=pos+i+1;current=i+1;
        if(records.length>=maxRecords)break readChunks;
      }
      if(current<bytesRead){
        partial=Buffer.concat([partial,buf.subarray(current,bytesRead)]);
        if(partial.length>MAX_RECORD_BYTES) throw new Error('JSONL partial line exceeds 16 MiB; checkpoint unchanged');
      }
      pos+=bytesRead;
    }
    const firstBytes=prefix;
    return {records,next:{fileIdentity:identity,firstBytes,byteOffset:partialStart,fileGenerationId,generationCounter:generation},pendingPartialLine:partial.length>0,hasMore:partialStart<stat.size};
  }finally{await fd.close();}
}
