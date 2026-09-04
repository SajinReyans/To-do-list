/**
 * Lightweight, in-memory sliding window rate limiter.
 * Protects against brute-force and denial-of-service without adding external dependencies.
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || (parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000);
  const max = options.max || (parseInt(process.env.RATE_LIMIT_MAX, 10) || 120);
  const message = options.message || { error: "Too many requests, please try again later." };
  
  // Map of key -> array of timestamps
  const hits = new Map();

  // Periodically clean up stale entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, 5 * 60 * 1000);

  // Unref interval so it doesn't block process exit in tests
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return function rateLimiter(req, res, next) {
    // In test environment, allow disabling or bypassing if desired
    if (process.env.DISABLE_RATE_LIMIT === "true") {
      return next();
    }

    const key = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global";
    const now = Date.now();

    let timestamps = hits.get(key) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      res.setHeader("Retry-After", resetInSeconds > 0 ? resetInSeconds : 1);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", 0);
      return res.status(429).json(message);
    }

    timestamps.push(now);
    hits.set(key, timestamps);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - timestamps.length));

    next();
  };
}
