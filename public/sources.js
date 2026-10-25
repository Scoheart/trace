// Local source management, deliberately isolated from the timeline controller.
const $=id=>document.getElementById(id);
const node=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=String(content);return e;};
let token='';let opened=false;let refreshing=false;
const api=async(path,method='GET',body)=>{
  const response=await fetch(path,{method,headers:method==='GET'?{}:{'content-type':'application/json','x-trace-csrf':token},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||`Request failed (${response.status})`);
  return result;
};
const status=(message,error=false)=>{$('sourceStatus').textContent=message;$('sourceStatus').classList.toggle('error',error);};
function switchTab(sources){
  opened=sources;
  $('traceView').hidden=sources;$('inspector').hidden=sources;
  $('sourceManagement').hidden=!sources;
  $('appLayout').classList.toggle('source-open',sources);
  $('navSources').classList.toggle('active',sources);
  $('navSessions').classList.toggle('active',!sources);
  $('navSources').setAttribute('aria-current',sources?'page':'false');
  $('navSessions').setAttribute('aria-current',sources?'false':'page');
  if(sources)refresh().catch(error=>status(error.message,true));
}
const action=(text,callback,css='')=>{const b=node('button',`source-action ${css}`,text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await callback();await refresh();}catch(error){status(error.message,true);}finally{b.disabled=false;}};return b;};
function renderSources(sources){
  const list=$('sourceList');list.replaceChildren();
  if(!sources.length){list.append(node('div','source-empty','No sources yet. Connect your first Agent on the left.'));return;}
  for(const source of sources){
    const row=node('article','collector');
    const head=node('div','collector-head');
    const name=node('strong',null,source.agent==='codex'?'◈ Codex CLI':'✦ Claude Code');
    const badge=node('span',source.status==='error'?'source-badge failure':source.autoScan?'source-badge running':'source-badge',source.status==='error'?'Error':source.autoScan?'Auto-follow':'Manual');
    head.append(name,badge);row.append(head,node('code','collector-path',source.root));
    row.append(node('p','collector-meta',source.lastScanAt?`Last scan ${new Date(source.lastScanAt).toLocaleString()} · +${source.lastImported} records`:'Never scanned'));
    if(source.lastError)row.append(node('p','collector-error',source.lastError));
    const buttons=node('div','collector-controls');
    buttons.append(action('↻ Scan now',async()=>{const result=await api(`/api/sources/${source.id}/scan`,'POST');status(`Scanned ${source.agent}: +${result.imported} new records`);await refreshSessionList();},'emphasis'));
    buttons.append(action(source.autoScan?'Pause follow':'Enable follow',async()=>{await api(`/api/sources/${source.id}`,'PATCH',{autoScan:!source.autoScan});status(`Updated follow setting for ${source.agent}`);}));
    buttons.append(action('Remove',async()=>{if(!confirm('Remove this source? Previously captured evidence will stay on this device.'))return;await api(`/api/sources/${source.id}`,'DELETE');status('Source removed; captured history retained.');},'delete'));
    row.append(buttons);list.append(row);
  }
}
async function refreshSessionList(){const res=await api('/api/sessions');$('total').textContent=`${res.length} available sessions`;}
async function refresh(){
  if(refreshing)return;
  refreshing=true;
  try{
    const [overview,sources]=await Promise.all([api('/api/overview'),api('/api/sources')]);
    $('statSessions').textContent=overview.sessionCount.toLocaleString();
    $('statEvidence').textContent=overview.evidenceCount.toLocaleString();
    $('statSources').textContent=overview.sourceCount.toLocaleString();
    $('statFollowing').textContent=overview.runningSources.toLocaleString();
    renderSources(sources);
  }finally{refreshing=false;}
}
async function boot(){
  const bootstrap=await api('/api/bootstrap');token=bootstrap.csrfToken;
  $('navSources').addEventListener('click',()=>switchTab(true));
  $('navSessions').addEventListener('click',()=>{switchTab(false);window.location.reload();});
  $('addSourceForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!$('sourceConsent').checked){status('Please authorize access to this directory.',true);return;}
    const button=$('addSourceButton');button.disabled=true;status('Registering directory…');
    try{
      const source=await api('/api/sources','POST',{agent:$('sourceAgent').value,root:$('sourceRoot').value,consent:true,autoScan:$('sourceAuto').checked});
      const scan=await api(`/api/sources/${source.id}/scan`,'POST');
      status(`Connected ${source.agent}; imported ${scan.imported} historical records.`);
      $('sourceConsent').checked=false;
      await refresh();await refreshSessionList();
    }catch(error){status(error.message,true);await refresh();}finally{button.disabled=false;}
  });
  // First open the collection manager when there is no data yet.
  const initial=await api('/api/overview');
  if(!initial.sessionCount)switchTab(true);
  const poll=setInterval(()=>{if(opened)refresh().catch(()=>{});},5000);
  window.addEventListener('pagehide',()=>clearInterval(poll),{once:true});
}
boot().catch(error=>status(`Could not initialize local collector: ${error.message}`,true));
