import { Router } from "express";
import { supabase } from "../supabase.js";
import { validateUUIDParam, isValidDate, isValidYear, sanitizeTitle } from "../middleware/validation.js";

const router = Router();

function formatHabit(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    color: row.color || null,
    icon: row.icon || null,
    year: row.year,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

// GET all habits for a specific year (with on-the-fly year rollover)
router.get("/", async (req, res) => {
  const currentYear = new Date().getFullYear();
  let year = currentYear;

  if (req.query.year !== undefined) {
    if (!isValidYear(req.query.year)) {
      return res.status(400).json({ error: "Invalid year parameter (must be between 1970 and 2100)" });
    }
    year = parseInt(req.query.year, 10);
  }

  const db = req.supabase || supabase;
  try {
    let { data: habits, error } = await db
      .from("habits")
      .select("*")
      .eq("user_id", req.userId)
      .eq("year", year)
      .eq("archived", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Automatic Year Rollover:
    // If querying current year and no habits exist for it, check if previous active habits exist
    if ((!habits || habits.length === 0) && year === currentYear) {
      const { data: prevHabits, error: prevError } = await db
        .from("habits")
        .select("*")
        .eq("user_id", req.userId)
        .eq("archived", false)
        .lt("year", currentYear)
        .order("year", { ascending: false });

      if (prevError) throw prevError;

      if (prevHabits && prevHabits.length > 0) {
        // Pick habits from the latest previous year
        const latestPrevYear = prevHabits[0].year;
        const habitsToRollover = prevHabits.filter((h) => h.year === latestPrevYear);

        if (habitsToRollover.length > 0) {
          const newYearInserts = habitsToRollover.map((h) => ({
            user_id: req.userId,
            title: h.title,
            color: h.color,
            icon: h.icon,
            year: currentYear,
            archived: false,
          }));

          const { data: createdHabits, error: insertError } = await db
            .from("habits")
            .insert(newYearInserts)
            .select();

          if (insertError) throw insertError;
          habits = createdHabits || [];
        }
      }
    }

    res.json((habits || []).map(formatHabit));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error fetching habits:`, err.message);
    }
    res.status(500).json({ error: "Failed to fetch habits" });
  }
});

// GET all habit completions for a given year (bulk load)
router.get("/completions", async (req, res) => {
  const currentYear = new Date().getFullYear();
  let year = currentYear;

  if (req.query.year !== undefined) {
    if (!isValidYear(req.query.year)) {
      return res.status(400).json({ error: "Invalid year parameter (must be between 1970 and 2100)" });
    }
    year = parseInt(req.query.year, 10);
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("habit_completions")
      .select("id, habit_id, date, completed")
      .eq("user_id", req.userId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) throw error;

    // Return as map { [habitId]: { [date]: true/false } }
    const completionsMap = {};
    for (const row of data || []) {
      if (!completionsMap[row.habit_id]) {
        completionsMap[row.habit_id] = {};
      }
      completionsMap[row.habit_id][row.date] = row.completed;
    }

    res.json(completionsMap);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error fetching completions:`, err.message);
    }
    res.status(500).json({ error: "Failed to fetch habit completions" });
  }
});

// POST create a new habit
router.post("/", async (req, res) => {
  const title = sanitizeTitle(req.body?.title, 200);
  if (!title) {
    return res.status(400).json({ error: "Title is required (maximum 200 characters)" });
  }

  let targetYear = new Date().getFullYear();
  if (req.body?.year !== undefined) {
    if (!isValidYear(req.body.year)) {
      return res.status(400).json({ error: "Invalid year (must be between 1970 and 2100)" });
    }
    targetYear = parseInt(req.body.year, 10);
  }

  const color =
    typeof req.body?.color === "string" && req.body.color.trim().length <= 30
      ? req.body.color.trim()
      : null;

  const icon =
    typeof req.body?.icon === "string" && req.body.icon.trim().length <= 30
      ? req.body.icon.trim()
      : null;

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("habits")
      .insert({
        user_id: req.userId,
        title,
        color,
        icon,
        year: targetYear,
        archived: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatHabit(data));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error creating habit:`, err.message);
    }
    res.status(500).json({ error: "Failed to create habit" });
  }
});

// PATCH update habit (title, color, icon, archived)
router.patch("/:id", validateUUIDParam("id"), async (req, res) => {
  const updates = {};
  
  if (req.body?.title !== undefined) {
    const title = sanitizeTitle(req.body.title, 200);
    if (!title) {
      return res.status(400).json({ error: "Title cannot be empty (maximum 200 characters)" });
    }
    updates.title = title;
  }

  if (req.body?.color !== undefined) {
    updates.color =
      typeof req.body.color === "string" && req.body.color.trim().length <= 30
        ? req.body.color.trim()
        : null;
  }

  if (req.body?.icon !== undefined) {
    updates.icon =
      typeof req.body.icon === "string" && req.body.icon.trim().length <= 30
        ? req.body.icon.trim()
        : null;
  }

  if (req.body?.archived !== undefined) {
    if (typeof req.body.archived !== "boolean") {
      return res.status(400).json({ error: "Archived must be a boolean" });
    }
    updates.archived = req.body.archived;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid update fields provided" });
  }

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("habits")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Habit not found" });

    res.json(formatHabit(data));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error updating habit:`, err.message);
    }
    res.status(500).json({ error: "Failed to update habit" });
  }
});

// DELETE habit
router.delete("/:id", validateUUIDParam("id"), async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("habits")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Habit not found" });
    }

    res.status(204).end();
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error deleting habit:`, err.message);
    }
    res.status(500).json({ error: "Failed to delete habit" });
  }
});

// GET completions for a single habit
router.get("/:id/completions", validateUUIDParam("id"), async (req, res) => {
  const currentYear = new Date().getFullYear();
  let year = currentYear;

  if (req.query.year !== undefined) {
    if (!isValidYear(req.query.year)) {
      return res.status(400).json({ error: "Invalid year parameter (must be between 1970 and 2100)" });
    }
    year = parseInt(req.query.year, 10);
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = req.supabase || supabase;
  try {
    // Verify habit ownership
    const { data: habit, error: habitError } = await db
      .from("habits")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .maybeSingle();

    if (habitError) throw habitError;
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    const { data, error } = await db
      .from("habit_completions")
      .select("date, completed")
      .eq("habit_id", req.params.id)
      .eq("user_id", req.userId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) throw error;

    const map = {};
    for (const row of data || []) {
      map[row.date] = row.completed;
    }

    res.json(map);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error fetching habit completions:`, err.message);
    }
    res.status(500).json({ error: "Failed to fetch habit completions" });
  }
});

// PATCH toggle or set completion for a specific habit and date
router.patch("/:id/completions", validateUUIDParam("id"), async (req, res) => {
  const { date, completed } = req.body || {};
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Valid date in YYYY-MM-DD format is required" });
  }

  const isCompleted = typeof completed === "boolean" ? completed : true;

  const db = req.supabase || supabase;
  try {
    // IDOR Prevention: Verify that the habit exists and belongs to the authenticated user
    const { data: habit, error: habitCheckError } = await db
      .from("habits")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .maybeSingle();

    if (habitCheckError) throw habitCheckError;
    if (!habit) {
      return res.status(404).json({ error: "Habit not found or access denied" });
    }

    const { data, error } = await db
      .from("habit_completions")
      .upsert(
        {
          user_id: req.userId,
          habit_id: req.params.id,
          date,
          completed: isCompleted,
        },
        { onConflict: "habit_id, date" }
      )
      .select()
      .single();

    if (error) throw error;
    res.json({ date: data.date, completed: data.completed });
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error updating habit completion:`, err.message);
    }
    res.status(500).json({ error: "Failed to update habit completion" });
  }
});

export default router;
