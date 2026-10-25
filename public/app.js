import { filterEvents, describeObservedCoverage } from './viewer-model.js';

// DOM-safe rendering: untrusted source text is inserted with textContent.
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const pretty=value=>typeof value==='string'?value:JSON.stringify(value,null,2);
const shorten=(value,max=110)=>String(value??'').length>max?String(value).slice(0,max)+'…':String(value??'');
const request=async path=>{const response=await fetch(path);const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;};
let current=null,offset=0,loaded=[],selectedId=null,loadingSession=null;

function showError(message) {$('notice').textContent=message;}
async function loadSessions() {
  const sessions=await request('/api/sessions');
  $('total').textContent=`${sessions.length} available sessions`;
  $('sessions').replaceChildren();
  if(!sessions.length){$('sessions').append(el('div','empty','No sessions imported yet.'));return;}
  sessions.forEach(session=>{
    const btn=el('button','session');
    btn.append(el('strong',null,`${session.agentId==='codex'?'◈':'✦'} ${session.agentId.toUpperCase()}`),
      el('small',null,shorten(session.nativeSessionId||session.sessionId.slice(0,20))),
      el('small',null,`${session.records} records · ${new Date(session.lastObservedAt).toLocaleString()}`));
    btn.onclick=()=>selectSession(session,btn);
    $('sessions').append(btn);
  });
}
async function selectSession(session,button) {
  document.querySelectorAll('.session').forEach(x=>x.classList.remove('active'));
  button.classList.add('active');
  current=session;offset=0;loaded=[];selectedId=null;
  $('heading').textContent=session.nativeSessionId||`Session ${session.sessionId.slice(0,12)}`;
  $('meta').textContent=`${session.agentId.toUpperCase()} · Native session grouping · Historical playback`;
  $('agent').textContent=session.agentId.toUpperCase();
  $('count').textContent=String(session.records);
  $('eventsMetric').textContent='—';
  $('coverage').textContent='Calculating observed coverage…';
  $('filterKind').value='all';$('timelineSearch').value='';
  $('events').replaceChildren();$('details').replaceChildren();
  $('hint').textContent='Choose a captured event to view claims and retained evidence.';
  $('notice').textContent='';
  await more();
}
function renderTimeline() {
  const filtered=filterEvents(loaded,{kind:$('filterKind').value,query:$('timelineSearch').value});
  const list=$('events');list.replaceChildren();
  $('visibleCount').textContent=`Showing ${filtered.length} of ${loaded.length} loaded events`;
  if(!filtered.length){list.append(el('div','empty','No matching captured events in the loaded records.'));return;}
  for(const event of filtered) {
    const btn=el('button','event');
    btn.dataset.eventId=event.eventId;
    if(event.parentEventId)btn.classList.add('linked-result');
    if(selectedId===event.eventId)btn.classList.add('selected');
    const glyph=event.kind==='tool_call'?'⚙':event.kind==='tool_result'?'↳':event.kind.endsWith('_message')?'◇':event.kind==='usage'?'◉':'•';
    btn.append(el('span','glyph',glyph));
    const body=el('div','eventbody');
    body.append(el('strong',null,event.summary),el('p',null,shorten(pretty(event.content),160)));
    const provenance=el('div','provenance');
    provenance.append(el('span','mini-badge',`${event.evidenceRefs.length} source${event.evidenceRefs.length===1?'':'s'}`));
    if(event.identityStrength==='native_call')provenance.append(el('span','mini-badge','Native call ID'));
    if(event.conflicts.length)provenance.append(el('span','mini-badge conflict',`${event.conflicts.length} conflict${event.conflicts.length===1?'':'s'}`));
    if(event.parentEventId)provenance.append(el('span','mini-badge','Call-linked result'));
    body.append(provenance);
    const right=el('div','eventright');
    right.append(el('span','kind',event.kind));
    right.append(el('span','timestamp',event.occurredAt||event.observedAt||'Time unknown'));
    btn.append(body,right);
    btn.onclick=()=>inspect(event).catch(e=>showError(e.message));
    list.append(btn);
  }
}
async function more() {
  if(!current||loadingSession===current.sessionId)return;
  const selectedSession=current.sessionId;
  loadingSession=selectedSession;
  $('loadMore').disabled=true;
  try{
    const page=await request(`/api/sessions/${selectedSession}/timeline?offset=${offset}&limit=150`);
    if(current?.sessionId!==selectedSession)return;
    loaded.push(...page.events);
    offset+=page.events.length;
    $('eventsMetric').textContent=String(page.totalEvents);
    $('coverage').textContent=describeObservedCoverage(page.coverage);
    $('observability').textContent=`${page.coverage.conflictingEvents} conflicting event(s) · ${page.coverage.invalidRecords} malformed record(s) · no invented coverage percentage`;
    $('loadMore').hidden=!page.hasMore;
    renderTimeline();
  }catch(error){if(current?.sessionId===selectedSession)showError(error.message);}
  finally{if(loadingSession===selectedSession){loadingSession=null;$('loadMore').disabled=false;}}
}
async function inspect(event) {
  selectedId=event.eventId;renderTimeline();
  $('hint').textContent=`${event.kind} · ${event.summary}`;
  const target=$('details');target.replaceChildren();
  const field=(label,value)=>{target.append(el('label',null,label),el('code',null,value??'—'));};
  field('Canonical event ID',event.eventId);
  field('Identity / association',event.identityStrength);
  if(event.callId)field('Native tool call ID',event.callId);
  if(event.parentEventId)field('Linked parent event',event.parentEventId);
  field('Occurred at',event.occurredAt||'Not present in source');
  field('Observed at',event.observedAt);
  field('Source transformations',event.transformFlags.length?event.transformFlags.join(', '):'None recorded');
  target.append(el('label',null,'Canonical event content'),el('pre',null,pretty(event.content)));
  if(event.conflicts.length){
    target.append(el('label',null,'Conflicting evidence (all alternatives retained)'));
    for(const conflict of event.conflicts){
      const container=el('div','conflict-panel');
      container.append(el('strong',null,`Field: ${conflict.field}`));
      for(const alternative of conflict.alternatives){
        container.append(el('code',null,`Evidence ${alternative.evidenceId.slice(0,12)}`));
        container.append(el('pre',null,pretty(alternative.value)));
      }
      target.append(container);
    }
  }
  target.append(el('label',null,'Evidence sources'));
  target.append(el('div','source-note',`${event.evidenceRefs.length} source record(s) · click each to inspect retained original`));
  for(const evidenceId of event.evidenceRefs){
    const wrapper=el('section','evidence-source');
    const heading=el('button','evidence-toggle',`View evidence ${evidenceId.slice(0,16)}…`);
    heading.setAttribute('aria-expanded','false');
    heading.onclick=async()=>{
      if(wrapper.querySelector('.evidence-payload')){wrapper.querySelector('.evidence-payload').remove();heading.setAttribute('aria-expanded','false');return;}
      heading.disabled=true;
      try{
        const proof=await request(`/api/evidence/${evidenceId}`);
        if(selectedId!==event.eventId)return;
        const details=el('div','evidence-payload');
        details.append(el('code',null,`Source: ${proof.metadata.sourceKind} · ${proof.metadata.sourceName??'unknown file'}`));
        details.append(el('code',null,`Offset: ${proof.metadata.sourceByteOffset} · SHA-256 verified: ${proof.hashVerified}`));
        details.append(el('label',null,'Retained raw record · SHA-256 verified'));
        details.append(el('pre',null,proof.retainedText));
        wrapper.append(details);heading.setAttribute('aria-expanded','true');
      }catch(error){showError(`Evidence lookup failed: ${error.message}`);}
      finally{heading.disabled=false;}
    };
    wrapper.append(heading);target.append(wrapper);
  }
}
$('filterKind').addEventListener('change',renderTimeline);
$('timelineSearch').addEventListener('input',renderTimeline);
$('loadMore').onclick=()=>more();
loadSessions().catch(error=>showError(`Failed to load sessions: ${error.message}`));
