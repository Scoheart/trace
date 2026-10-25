import { importAgent } from './importer.js';

/** Serializes all scans because EvidenceStore uses one global checkpoint/index lock. */
export class CaptureService {
  constructor({ registry, storeDir, intervalMs = 5000 }) {
    this.registry = registry;
    this.storeDir = storeDir;
    this.intervalMs = intervalMs;
    this.queue = Promise.resolve();
    this.timer = null;
    this.active = new Map();
  }

  scan(id) {
    const source = this.registry.get(id);
    if (!source) return Promise.reject(new Error('Source not found'));
    if (this.active.has(id)) return this.active.get(id);
    const pending = this.queue.catch(() => {}).then(async () => {
      const startedAt = new Date().toISOString();
      try {
        const result = await importAgent({
          agent: source.agent, root: source.root, storeDir: this.storeDir, consent: true,
        });
        this.registry.recordRun(id, { startedAt, imported: result.imported, invalid: result.invalid });
        return result;
      } catch (error) {
        this.registry.recordRun(id, { startedAt, error: String(error.message).slice(0,1000) });
        throw error;
      }
    });
    this.queue = pending.catch(() => {});
    this.active.set(id, pending);
    pending.finally(() => { if (this.active.get(id) === pending) this.active.delete(id); }).catch(() => {});
    return pending;
  }

  async tick() {
    for (const source of this.registry.list().filter(s => s.autoScan)) {
      try { await this.scan(source.id); } catch (error) { console.error('[trace-capture]', source.agent, error.message); }
    }
  }

  start() {
    if (this.timer) return;
    // Start immediately after server init; timer is not a separate background service.
    this.tick().catch(err=>console.error('[trace-capture] scan failed',err.message));
    this.timer=setInterval(()=>this.tick().catch(err=>console.error('[trace-capture] scan failed',err.message)),this.intervalMs);
    this.timer.unref?.();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.queue.catch(() => {});
  }
}
