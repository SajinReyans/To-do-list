import "dotenv/config";
import express from "express";
import cors from "cors";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { requireAuth } from "./middleware/auth.js";
import queueRoutes from "./routes/queue.js";
import treeRoutes from "./routes/tree.js";
import settingsRoutes from "./routes/settings.js";
import habitsRoutes from "./routes/habits.js";

const app = express();

// Disable fingerprinting header
app.disable("x-powered-by");

// Apply standard security HTTP headers
app.use(securityHeaders);

// Restrictive CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:4000", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server) or in whitelist
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: origin not allowed"));
      }
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);

// Protect against oversized payload attacks
app.use(express.json({ limit: "50kb" }));

// Handle malformed JSON body errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  next(err);
});

// Apply rate limiting to all API endpoints
const apiLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 120,
});
app.use("/api", apiLimiter);

// Public health check endpoint
app.get("/api/health", (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Protected endpoints requiring valid Supabase user JWT
app.use("/api/queue", requireAuth, queueRoutes);
app.use("/api/tree", requireAuth, treeRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/habits", requireAuth, habitsRoutes);

// 404 handler for unmatched API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[${new Date().toISOString()}] Unhandled Server Error:`, err);
  }
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred"
      : err.message || "Internal Server Error";

  res.status(status).json({ error: message });
});

export default app;
export { app };
