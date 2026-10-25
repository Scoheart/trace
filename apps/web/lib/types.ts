export type AgentId = 'codex' | 'claude' | (string & {});
export type EventKind =
  | 'session' | 'user_message' | 'assistant_message' | 'tool_call' | 'tool_result'
  | 'usage' | 'shell' | 'file_change' | 'mcp' | 'skill' | 'subagent'
  | 'error' | 'invalid_json' | 'unparsed' | 'other';

export interface TraceSession {
  sessionId: string;
  agentId: AgentId;
  nativeSessionId: string | null;
  records: number;
  startedAt: string;
  lastObservedAt: string;
}

export interface EvidenceVariant {
  value: unknown;
  evidenceId: string;
  claimId: string;
}
export interface TraceConflict {
  field: string;
  alternatives: EvidenceVariant[];
}
export interface TraceEvent {
  eventId: string;
  sessionId: string;
  agentId: AgentId;
  kind: EventKind;
  summary: string;
  content: unknown;
  identityStrength: 'native_call' | 'source_only';
  callId: string | null;
  occurredAt: string | null;
  observedAt: string;
  sourceKind: string;
  sourceName: string | null;
  sourceByteOffset: number;
  evidenceRefs: string[];
  claimIds: string[];
  conflicts: TraceConflict[];
  parentEventId: string | null;
  transformFlags: string[];
}
export interface CaptureCoverage {
  rawRecordCount: number;
  canonicalEventCount: number;
  invalidRecords: number;
  conflictingEvents: number;
  [kind: string]: number | { state: 'observed' | 'not_verified'; count: number };
}
export interface TimelinePage {
  sessionId: string;
  fusionVersion: number;
  rawEvidenceCount: number;
  totalEvents: number;
  unmergedClaims: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  coverage: CaptureCoverage;
  events: TraceEvent[];
}
export interface RetainedEvidence {
  metadata: {
    evidenceId: string;
    sourceKind: string;
    sourceName?: string;
    sourceByteOffset: number;
    transformFlags: string[];
    [key: string]: unknown;
  };
  retainedText: string;
  hashVerified: boolean;
}
export interface Overview {
  mode: 'local';
  sessionCount: number;
  evidenceCount: number;
  sourceCount: number;
  runningSources: number;
  agents: string[];
  errors: number;
}
export interface LocalSource {
  id: string;
  agent: 'codex' | 'claude';
  root: string;
  autoScan: boolean;
  consentAt: string;
  createdAt: string;
  lastScanAt: string | null;
  lastImported: number;
  lastError: string | null;
  status: 'ok' | 'error' | string;
}
export interface ScanResult {
  agent: string;
  discovered: number;
  imported: number;
  invalid: number;
  partial: number;
}
export interface Bootstrap {
  mode: string;
  csrfToken: string;
  supportedAgents: string[];
  cloudEnabled: boolean;
  version: string;
}
