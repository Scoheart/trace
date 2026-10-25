import { createHash } from 'node:crypto';

export function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

/** Length-prefixing prevents ambiguous concatenation of identity fields. */
export function makeEvidenceId({installationId,agentId,sourceKind,sourceFileGenerationId,sourceByteOffset,payloadSha256}) {
  const parts=[installationId,agentId,sourceKind,sourceFileGenerationId,String(sourceByteOffset),payloadSha256];
  const bytes=parts.map(p=>`${Buffer.byteLength(p,'utf8')}:${p}`).join('|');
  return sha256(bytes);
}

export function parseSourceEnvelope(input) {
  if(!input || typeof input!=='object'||Array.isArray(input)) throw new Error('Invalid evidence envelope');
  for(const key of ['evidenceId','installationId','agentId','adapterId','adapterVersion','sourceKind','sourceFileGenerationId','sourceRecordId','payloadSha256','payloadBase64','consentId','observedAt']) {
    if(typeof input[key]!=='string'||!input[key].length) throw new Error(`Missing or invalid ${key === 'consentId'?'consent':key}`);
  }
  if(input.schemaVersion!==1||!Number.isSafeInteger(input.sourceByteOffset)||input.sourceByteOffset<0) throw new Error('Invalid evidence version or offset');
  const payload=Buffer.from(input.payloadBase64,'base64');
  if(sha256(payload)!==input.payloadSha256) throw new Error('Payload hash mismatch');
  if(input.evidenceId!==makeEvidenceId(input)) throw new Error('Evidence identity mismatch');
  if(!Array.isArray(input.transformFlags)) throw new Error('Missing transform flags');
  return input;
}
