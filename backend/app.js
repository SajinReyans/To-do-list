import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";
import queueRoutes from "./routes/queue.js";
import treeRoutes from "./routes/tree.js";
import settingsRoutes from "./routes/settings.js";
import habitsRoutes from "./routes/habits.js";

const app = express();

// Configure CORS for local development and production deployments
app.use(cors());
app.use(express.json());

// Public endpoints
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Protected endpoints requiring valid Supabase user JWT
app.use("/api/queue", requireAuth, queueRoutes);
app.use("/api/tree", requireAuth, treeRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);
app.use("/api/habits", requireAuth, habitsRoutes);

export default app;
export { app };
