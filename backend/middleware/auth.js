import { supabase, getSupabaseForUser } from "../supabase.js";

// In-memory token verification cache to eliminate remote latency on repeated user requests
const tokenCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL
const MAX_CACHE_SIZE = 1000;

export function clearTokenCache() {
  tokenCache.clear();
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  if (!token) {
    return res.status(401).json({ error: "Access token is required" });
  }

  // Allow guest token in local development or test mode when Supabase is not configured
  if (token === "mock-guest-token" && (process.env.NODE_ENV !== "production" || !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder"))) {
    const guestUser = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "guest@aloft.local",
    };
    req.userId = guestUser.id;
    req.user = guestUser;
    req.supabase = getSupabaseForUser(token);
    return next();
  }

  const now = Date.now();

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    req.userId = cached.user.id;
    req.user = cached.user;
    req.supabase = getSupabaseForUser(token);
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      tokenCache.delete(token);
      return res.status(401).json({ error: "Invalid or expired access token" });
    }

    // Determine cache TTL (respecting JWT exp claim if present)
    let ttl = CACHE_TTL_MS;
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        if (payload.exp) {
          const jwtRemaining = payload.exp * 1000 - now;
          if (jwtRemaining > 0) {
            ttl = Math.min(CACHE_TTL_MS, jwtRemaining);
          }
        }
      }
    } catch {
      // Ignore parse error, use default TTL
    }

    if (tokenCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = tokenCache.keys().next().value;
      tokenCache.delete(oldestKey);
    }

    tokenCache.set(token, { user, expiresAt: now + ttl });

    req.userId = user.id;
    req.user = user;
    // Attach scoped Supabase client with user credentials for PostgREST RLS compliance
    req.supabase = getSupabaseForUser(token);
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Auth verification error:`, err.message);
    }
    return res.status(401).json({ error: "Authentication failed" });
  }
}

