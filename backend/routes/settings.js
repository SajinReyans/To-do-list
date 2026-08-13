import { Router } from "express";
import { readDb, writeDb } from "../store.js";

const router = Router();

const VALID_THEMES = [
  "cottonCandy",
  "monochrome",
  "sunsetEmber",
  "royalViolet",
  "electricSky",
  "mauveBerry",
  "tropicalPop",
];

router.get("/", async (req, res) => {
  const db = await readDb();
  res.json(db.settings);
});

router.patch("/", async (req, res) => {
  const { theme } = req.body;
  if (theme && !VALID_THEMES.includes(theme)) {
    return res.status(400).json({ error: "Unknown theme" });
  }
  const db = await readDb();
  if (theme) db.settings.theme = theme;
  await writeDb(db);
  res.json(db.settings);
});

export default router;
