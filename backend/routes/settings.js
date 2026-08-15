import { Router } from "express";
import { supabase } from "../supabase.js";

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

const DEFAULT_THEME = "cottonCandy";

// GET user settings
router.get("/", async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("user_settings")
      .select("theme")
      .eq("user_id", req.userId)
      .maybeSingle();

    if (error) throw error;
    res.json({ theme: data?.theme || DEFAULT_THEME });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update user settings
router.patch("/", async (req, res) => {
  const { theme } = req.body;
  if (theme && !VALID_THEMES.includes(theme)) {
    return res.status(400).json({ error: "Unknown theme" });
  }

  const db = req.supabase || supabase;
  try {
    const newTheme = theme || DEFAULT_THEME;
    const { data, error } = await db
      .from("user_settings")
      .upsert(
        {
          user_id: req.userId,
          theme: newTheme,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("theme")
      .single();

    if (error) throw error;
    res.json({ theme: data?.theme || newTheme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
