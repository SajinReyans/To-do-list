import express from "express";
import cors from "cors";
import queueRoutes from "./routes/queue.js";
import treeRoutes from "./routes/tree.js";
import settingsRoutes from "./routes/settings.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/queue", queueRoutes);
app.use("/api/tree", treeRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Todo backend running on http://localhost:${PORT}`);
});
