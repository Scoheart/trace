import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEvidenceId,sha256,parseSourceEnvelope } from '../src/envelope.js';
import { projectEvent } from '../src/project.js';
import { evidenceToClaims,fuseClaims,logicalSessionId,timelineCoverage } from '../src/fusion.js';
import {sanitizeRecord} from '../src/redact.js';
import {filterEvents} from '../public/viewer-model.js';

function envelope(offset,record){const payload=Buffer.from(JSON.stringify(record));const e={schemaVersion:1,installationId:'local-a',agentId:'codex',adapterId:'codex-local-jsonl',adapterVersion:'0.1',sourceKind:'transcript_file',sourceFileGenerationId:'file-a',sourceRecordId:String(offset),sourceByteOffset:offset,payloadSha256:sha256(payload),payloadBase64:payload.toString('base64'),transformFlags:[],consentId:'test-consent',observedAt:'2026-01-01T00:00:00Z',sessionId:'fallback',sourceNativeSessionId:'session-a'};e.evidenceId=makeEvidenceId(e);return e;}
test('sha256 integrity rejects tampering',()=>{const e=envelope(0,{hello:'world'});assert.equal(parseSourceEnvelope(e),e);assert.throws(()=>parseSourceEnvelope({...e,payloadBase64:Buffer.from('tampered').toString('base64')}),/hash mismatch/i);});
test('authorization and tokens are redacted before persistence',()=>{const data=sanitizeRecord(Buffer.from('{"authorization":"Bearer supersecretlongvalue","password":"secret"}'));const result=data.retainedBytes.toString();assert.doesNotMatch(result,/supersecretlongvalue|secret"}/);assert.match(result,/REDACTED/);});
test('native call and result remain distinct but causally linked',()=>{const records=[{type:'response_item',payload:{type:'function_call',name:'shell',call_id:'x',arguments:'cmd'}},{type:'response_item',payload:{type:'function_call_output',call_id:'x',output:'ok'}}];const claims=records.flatMap((r,i)=>evidenceToClaims(envelope(i, r),r));const result=fuseClaims(claims);assert.equal(result.events.length,2);assert.equal(result.events[1].parentEventId,result.events[0].eventId);});
test('same call ID is not merged across sessions',()=>{const rec={type:'response_item',payload:{type:'function_call',name:'shell',call_id:'same',arguments:'cmd'}};const a=envelope(0,rec),b={...envelope(10,rec),sourceNativeSessionId:'session-b'};const events=fuseClaims([...evidenceToClaims(a,rec),...evidenceToClaims(b,rec)]).events;assert.equal(events.length,2);assert.notEqual(logicalSessionId(a),logicalSessionId(b));});
test('coverage does not claim absent events',()=>{const c=timelineCoverage([],{rawRecordCount:1});assert.equal(c.tool_call.state,'not_verified');assert.equal(c.rawRecordCount,1);});
test('viewer filter narrows search and kind',()=>{const list=[{kind:'tool_call',summary:'Bash',content:'npm test'},{kind:'assistant_message',summary:'Done',content:'pass'}];assert.equal(filterEvents(list,{kind:'tool',query:'npm'}).length,1);assert.equal(filterEvents(list,{kind:'conversation'}).length,1);});
test('codex function call mapping',()=>{const x=projectEvent('codex',{type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'1',arguments:'{}'}});assert.equal(x[0].kind,'tool_call');assert.equal(x[0].callId,'1');});
