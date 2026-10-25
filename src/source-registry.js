import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const SUPPORTED_AGENTS = new Set(['codex', 'claude']);
function asSource(row) {
  if (!row) return null;
  return {
    id: row.id,
    agent: row.agent,
    root: row.root,
    autoScan: Boolean(row.auto_scan),
    consentAt: row.consent_at,
    createdAt: row.created_at,
    lastScanAt: row.last_scan_at,
    lastImported: row.last_imported ?? 0,
    lastError: row.last_error,
    status: row.status,
  };
}

/** Local-only registry. Evidence stays in encrypted files; SQLite stores no transcript text. */
export class SourceRegistry {
  constructor(db) { this.db = db; }

  static async open(storeDir) {
    const dir = path.resolve(storeDir);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.chmod(dir, 0o700);
    const dbPath = path.join(dir, 'sources.sqlite');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        root TEXT NOT NULL,
        auto_scan INTEGER NOT NULL DEFAULT 0,
        consent_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_scan_at TEXT,
        last_imported INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        UNIQUE(agent,root)
      );
      CREATE TABLE IF NOT EXISTS scan_runs (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        imported INTEGER NOT NULL,
        invalid INTEGER NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        FOREIGN KEY(source_id) REFERENCES sources(id)
      );
      CREATE INDEX IF NOT EXISTS idx_scan_runs_source ON scan_runs(source_id, finished_at DESC);
    `);
    await fs.chmod(dbPath, 0o600);
    return new SourceRegistry(db);
  }

  async add({ agent, root, consent, autoScan = false }) {
    if (consent !== true) throw new Error('Explicit consent to read this directory is required');
    if (!SUPPORTED_AGENTS.has(agent)) throw new Error('Unsupported agent type');
    if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('Source root must be an absolute path');
    const canonical = await fs.realpath(root);
    const stat = await fs.stat(canonical);
    if (!stat.isDirectory()) throw new Error('Source root must be a directory');
    const now = new Date().toISOString();
    const id = randomUUID();
    try {
      this.db.prepare(`INSERT INTO sources(id, agent, root, auto_scan, consent_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`).run(id, agent, canonical, autoScan === true ? 1 : 0, now, now);
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) throw new Error('Source is already registered');
      throw err;
    }
    return this.get(id);
  }

  list() { return this.db.prepare('SELECT * FROM sources ORDER BY created_at DESC, id').all().map(asSource); }
  get(id) { return asSource(this.db.prepare('SELECT * FROM sources WHERE id=?').get(id)); }
  setAutoScan(id, enabled) {
    const result = this.db.prepare('UPDATE sources SET auto_scan=? WHERE id=?').run(enabled ? 1 : 0, id);
    if (!result.changes) throw new Error('Source not found');
    return this.get(id);
  }
  remove(id) {
    this.db.prepare('DELETE FROM scan_runs WHERE source_id=?').run(id);
    const result = this.db.prepare('DELETE FROM sources WHERE id=?').run(id);
    if (!result.changes) throw new Error('Source not found');
  }
  recordRun(id, { startedAt, imported = 0, invalid = 0, error = null }) {
    if (!this.get(id)) return;
    const now = new Date().toISOString();
    const status = error ? 'error' : 'ok';
    this.db.prepare('INSERT INTO scan_runs(id,source_id,started_at,finished_at,imported,invalid,status,error) VALUES(?,?,?,?,?,?,?,?)')
      .run(randomUUID(), id, startedAt, now, imported, invalid, status, error);
    this.db.prepare('UPDATE sources SET last_scan_at=?,last_imported=?,last_error=?,status=? WHERE id=?')
      .run(now, imported, error, status, id);
  }
  listRuns(id, limit=20) {
    return this.db.prepare('SELECT * FROM scan_runs WHERE source_id=? ORDER BY finished_at DESC LIMIT ?').all(id, Math.min(100,Math.max(1,limit)));
  }
  close() { this.db.close(); }
}
