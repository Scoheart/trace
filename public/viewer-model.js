/** Pure viewer helpers; safe to exercise without a browser. */
const categories={
  tool:new Set(['tool_call','tool_result','mcp','skill','shell']),
  conversation:new Set(['user_message','assistant_message']),
  usage:new Set(['usage']),
  errors:new Set(['error','invalid_json'])
};
export function filterEvents(events,{kind='all',query=''}={}) {
  const searched=query.trim().toLocaleLowerCase();
  const allowed=categories[kind];
  return events.filter(event=>{
    if(allowed && !allowed.has(event.kind)) return false;
    if(!searched) return true;
    const fields=[event.summary,event.kind,event.callId,event.sourceName,
      typeof event.content==='string'?event.content:JSON.stringify(event.content)];
    return fields.some(item=>String(item??'').toLocaleLowerCase().includes(searched));
  });
}
export function describeObservedCoverage(coverage) {
  if(!coverage)return 'No capture report loaded.';
  const found=Object.entries(coverage).filter(([,value])=>value?.state==='observed').map(([key])=>key);
  return found.length ? `Observed categories: ${found.join(', ')}. Unlisted categories may be unobserved.` : 'No supported categories observed; absence is not proof of inactivity.';
}
