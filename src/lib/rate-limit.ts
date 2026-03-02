interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

class RateLimiter {
  private store = new Map<string, number[]>();
  private config: RateLimitConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  consume(key: string): RateLimitResult {
    this.ensureCleanup();

    const now = Date.now();
    const cutoff = now - this.config.windowMs;

    let timestamps = this.store.get(key);
    if (timestamps) {
      timestamps = timestamps.filter((t) => t > cutoff);
    } else {
      timestamps = [];
    }

    if (timestamps.length >= this.config.maxAttempts) {
      const oldestInWindow = timestamps[0];
      const retryAfterMs = oldestInWindow + this.config.windowMs - now;
      this.store.set(key, timestamps);
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  private ensureCleanup() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - this.config.windowMs;
      for (const [key, timestamps] of this.store) {
        const valid = timestamps.filter((t) => t > cutoff);
        if (valid.length === 0) {
          this.store.delete(key);
        } else {
          this.store.set(key, valid);
        }
      }
    }, 60_000);
    // Don't block process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

// 5 attempts per 60 seconds for login & register
export const authIpLimiter = new RateLimiter({
  windowMs: 60_000,
  maxAttempts: 5,
});

// 5 attempts per 60 seconds for TOTP verification
export const totpIpLimiter = new RateLimiter({
  windowMs: 60_000,
  maxAttempts: 5,
});

// 15 messages per 60 seconds for AI chat
export const chatLimiter = new RateLimiter({
  windowMs: 60_000,
  maxAttempts: 15,
});
