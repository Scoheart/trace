/** Derived, not source-of-truth: projection never discards a raw event. */
export function projectEvent(agent, record) {
  if(!record||typeof record!=='object') return [{kind:'unparsed',summary:'Non-object raw evidence',content:record}];
  const type=record.type,payload=record.payload||{},message=record.message||{},blocks=Array.isArray(message.content)?message.content:[];
  if(agent==='codex') {
    if(type==='session_meta') return [{kind:'session',summary:'Session started',content:payload}];
    if(type==='event_msg'&&payload.type==='user_message') return [{kind:'user_message',summary:'User prompt',content:payload.message??payload}];
    if(type==='event_msg'&&payload.type==='agent_message')return [{kind:'assistant_message',summary:'Agent response',content:payload.message??payload}];
    if(type==='event_msg'&&payload.type==='token_count')return [{kind:'usage',summary:'Token usage',content:payload.info??payload}];
    if(type==='response_item'&&payload.type==='function_call')return [{kind:'tool_call',summary:payload.name||'Tool call',callId:payload.call_id,content:payload.arguments??payload}];
    if(type==='response_item'&&payload.type==='function_call_output')return [{kind:'tool_result',summary:'Tool result',callId:payload.call_id,content:payload.output??payload}];
    if(type==='response_item'&&payload.type==='message')return [{kind:payload.role==='user'?'user_message':'assistant_message',summary:`${payload.role||'Message'}`,content:payload.content??payload}];
    if(type==='response_item'&&payload.type==='custom_tool_call')return [{kind:'tool_call',summary:payload.name||'Custom tool',callId:payload.call_id,content:payload.input??payload}];
  }
  if(agent==='claude') {
    const events=[];
    if(type==='assistant'||type==='user'){
      for(const block of blocks){
        if(block.type==='tool_use')events.push({kind:'tool_call',summary:block.name||'Tool call',callId:block.id,content:block.input??block});
        else if(block.type==='tool_result')events.push({kind:'tool_result',summary:'Tool result',callId:block.tool_use_id,content:block.content??block});
        else if(block.type==='text')events.push({kind:type==='user'?'user_message':'assistant_message',summary:type==='user'?'User prompt':'Agent response',content:block.text??''});
      }
      if(!events.length&&typeof message.content==='string') events.push({kind:type==='user'?'user_message':'assistant_message',summary:type==='user'?'User prompt':'Agent response',content:message.content});
      if(message.usage)events.push({kind:'usage',summary:'Token usage',content:message.usage});
      if(events.length)return events;
    }
  }
  return [{kind:'other',summary:String(type||'Unknown event'),content:record}];
}
