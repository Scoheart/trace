/** Best-effort local content sanitization, applied *before* disk writes. */
const secretField = /("(?:authorization|proxy-authorization|x-api-key|api[_-]?key|secret|access[_-]?token|refresh[_-]?token|password|client[_-]?secret|cookie|set-cookie)"\s*:\s*")((?:\\.|[^"\\])*)(")/gi;
const bearer = /\b(Bearer\s+)[A-Za-z0-9_+./=~-]{8,}/gi;
const knownToken = /\b(?:sk-(?:proj-|test-|live-)?[A-Za-z0-9_-]{8,}|gh[opsur]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,})\b/g;

export function sanitizeRecord(rawBytes) {
  let output=rawBytes.toString('utf8');
  const transformFlags=[];
  const apply=(re, replacement)=>{let found=false;output=output.replace(re,(...args)=>{found=true;return typeof replacement==='function'?replacement(...args):replacement;}); if(found) transformFlags.push('credentials_redacted');};
  apply(secretField,(_m,start,_val,end)=>start+'[REDACTED]'+end);
  apply(bearer,(_m,prefix)=>prefix+'[REDACTED]');
  apply(knownToken,'[REDACTED]');
  return {retainedBytes:Buffer.from(output,'utf8'),transformFlags:[...new Set(transformFlags)],warnings:['Best-effort sanitization cannot guarantee all secrets are detected.']};
}
