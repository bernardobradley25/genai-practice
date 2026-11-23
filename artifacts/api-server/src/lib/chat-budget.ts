/** Bounded, per-process protection for the anonymous demo; no IP or message storage. */
export class ChatBudget {
  private used = 0;
  private windowStart = 0;
  private active = 0;
  private limit: number;
  private intervalMs: number;
  private concurrency: number;
  constructor(limit = 100, intervalMs = 60 * 60 * 1000, concurrency = 3) {
    this.limit = limit; this.intervalMs = intervalMs; this.concurrency = concurrency;
  }

  acquire(now = Date.now()): { ok: true; release: () => void } | { ok: false; retryAfter: number } {
    if (now - this.windowStart >= this.intervalMs) { this.used = 0; this.windowStart = now; }
    if (this.active >= this.concurrency) return { ok: false, retryAfter: 15 };
    if (this.used >= this.limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((this.windowStart + this.intervalMs - now) / 1000)) };
    this.used++;
    this.active++;
    let released = false;
    return { ok: true, release: () => { if (!released) { released = true; this.active--; } } };
  }
}
