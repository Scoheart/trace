/**
 * Rebuildable, evidence-first canonical view.
 * This module never writes or modifies Raw Evidence. Matching is deliberately
 * conservative: timestamps, payload similarity and filenames are not identity.
 */
import { sha256 } from './envelope.js';
import { projectEvent } from './project.js';

const observedKinds = [
  'session','user_message','assistant_message','tool_call','tool_result',
  'usage','shell','file_change','mcp','skill','subagent','error',
  'other','invalid_json','unparsed'
];

const joinIdentity = values => JSON.stringify(values);
const usableDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

/** Prefer vendor-native sessions; a file generation is only a fallback scope. */
export function logicalSessionId(meta) {
  if (typeof meta.sourceNativeSessionId === 'string' && meta.sourceNativeSessionId.length) {
    return sha256(joinIdentity(['session-v1',meta.installationId,meta.agentId,meta.sourceNativeSessionId]));
  }
  return meta.sessionId;
}

/** Turn one retained source record into independent, provenance-carrying claims. */
export function evidenceToClaims(meta, source) {
  const events = meta.parseStatus === 'invalid_json'
    ? [{kind:'invalid_json',summary:'Malformed JSONL record',content:source.rawText ?? source}]
    : projectEvent(meta.agentId, source);
  return events.map((event, index) => ({
    claimId: sha256(joinIdentity(['claim-v1',meta.evidenceId,index])),
    evidenceId: meta.evidenceId,
    sessionId: logicalSessionId(meta),
    agentId: meta.agentId,
    installationId: meta.installationId,
    sourceKind: meta.sourceKind,
    sourceName: meta.sourceName ?? null,
    sourceByteOffset: meta.sourceByteOffset,
    occurredAt: meta.occurredAt ?? null,
    observedAt: meta.observedAt,
    transformFlags: meta.transformFlags || [],
    kind: event.kind,
    summary: event.summary,
    callId: typeof event.callId === 'string' && event.callId.length ? event.callId : null,
    content: event.content,
    identityStrength: ['tool_call','tool_result'].includes(event.kind) && event.callId ? 'native_call' : 'source_only'
  }));
}

function logicalEventKey(claim) {
  if (claim.identityStrength === 'native_call') {
    return sha256(joinIdentity(['call-v1',claim.installationId,claim.agentId,claim.sessionId,claim.kind,claim.callId]));
  }
  return sha256(joinIdentity(['claim-event-v1',claim.claimId]));
}

function compareClaims(a,b) {
  const aTime=usableDate(a.occurredAt)??usableDate(a.observedAt)??0;
  const bTime=usableDate(b.occurredAt)??usableDate(b.observedAt)??0;
  if(aTime!==bTime)return aTime-bTime;
  // Within one source, offsets represent observed transcript order.
  if(a.sourceName===b.sourceName && a.sourceKind===b.sourceKind) {
    if(a.sourceByteOffset!==b.sourceByteOffset) return a.sourceByteOffset-b.sourceByteOffset;
  }
  return a.claimId.localeCompare(b.claimId);
}

function variants(claims,field) {
  const results=new Map();
  for(const claim of claims) {
    const value=claim[field];
    const key=JSON.stringify(value);
    if(!results.has(key))results.set(key,{value,evidenceId:claim.evidenceId,claimId:claim.claimId});
  }
  return [...results.values()];
}

/** Only merge unambiguously identical native tool IDs in the same logical scope. */
export function fuseClaims(claims) {
  const groups=new Map();
  const dedupClaims=new Set();
  for(const claim of claims) {
    if(dedupClaims.has(claim.claimId))continue;
    dedupClaims.add(claim.claimId);
    const key=logicalEventKey(claim);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(claim);
  }
  const events=[];
  for(const [eventId,claimsForEvent] of groups) {
    claimsForEvent.sort(compareClaims);
    const first=claimsForEvent[0];
    const conflicts=['content','summary'].flatMap(field=>{
      const alternatives=variants(claimsForEvent,field);
      return alternatives.length>1?[{field,alternatives}]:[];
    });
    events.push({
      eventId,sessionId:first.sessionId,agentId:first.agentId,kind:first.kind,
      summary:first.summary,callId:first.callId,content:first.content,
      identityStrength:first.identityStrength,occurredAt:first.occurredAt,
      observedAt:first.observedAt,sourceKind:first.sourceKind,
      sourceName:first.sourceName,sourceByteOffset:first.sourceByteOffset,
      transformFlags:[...new Set(claimsForEvent.flatMap(x=>x.transformFlags))],
      evidenceRefs:[...new Set(claimsForEvent.map(x=>x.evidenceId))],
      claimIds:claimsForEvent.map(x=>x.claimId),conflicts,
      parentEventId:null
    });
  }
  // Explicit call IDs establish a causal link without collapsing call and result.
  const calls=new Map();
  for(const event of events)if(event.kind==='tool_call'&&event.callId){
    calls.set(joinIdentity([event.sessionId,event.agentId,event.callId]),event.eventId);
  }
  for(const event of events)if(event.kind==='tool_result'&&event.callId){
    event.parentEventId=calls.get(joinIdentity([event.sessionId,event.agentId,event.callId]))??null;
  }
  // Topological presentation: explicitly linked results follow their calls,
  // even when source clocks disagree. Unrelated events sort for display only.
  const byId=new Map(events.map(event=>[event.eventId,event]));
  const children=new Map(events.map(event=>[event.eventId,[]]));
  const indegree=new Map(events.map(event=>[event.eventId,0]));
  for(const event of events) {
    if(event.parentEventId && byId.has(event.parentEventId)) {
      children.get(event.parentEventId).push(event.eventId);
      indegree.set(event.eventId,indegree.get(event.eventId)+1);
    }
  }
  const compareForDisplay=(a,b)=>{
    const aTime=usableDate(a.occurredAt)??usableDate(a.observedAt)??0;
    const bTime=usableDate(b.occurredAt)??usableDate(b.observedAt)??0;
    if(aTime!==bTime)return aTime-bTime;
    if(a.sourceName===b.sourceName && a.sourceKind===b.sourceKind && a.sourceByteOffset!==b.sourceByteOffset)
      return a.sourceByteOffset-b.sourceByteOffset;
    return a.eventId.localeCompare(b.eventId);
  };
  const ready=events.filter(event=>indegree.get(event.eventId)===0);
  const ordered=[];
  while(ready.length) {
    ready.sort(compareForDisplay);
    const next=ready.shift();
    ordered.push(next);
    for(const child of children.get(next.eventId)) {
      const remaining=indegree.get(child)-1;
      indegree.set(child,remaining);
      if(remaining===0)ready.push(byId.get(child));
    }
  }
  // Future parser defects must not silently drop cyclic events.
  if(ordered.length!==events.length) {
    const done=new Set(ordered.map(event=>event.eventId));
    ordered.push(...events.filter(event=>!done.has(event.eventId)).sort(compareForDisplay));
  }
  return {events:ordered,unmergedClaims:ordered.filter(x=>x.identityStrength==='source_only').length};
}

/** No invented completeness percentage; unrecorded categories remain not_verified. */
export function timelineCoverage(events,{rawRecordCount=0,invalidRecords=0}={}) {
  const coverage={rawRecordCount,canonicalEventCount:events.length,invalidRecords,
    conflictingEvents:events.filter(x=>x.conflicts.length).length};
  for(const kind of observedKinds) {
    const n=events.filter(x=>x.kind===kind).length;
    coverage[kind]={state:n>0?'observed':'not_verified',count:n};
  }
  return coverage;
}
