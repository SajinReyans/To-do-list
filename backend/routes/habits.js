import { Router } from "express";
import { supabase } from "../supabase.js";

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
  const year = req.query.year ? parseInt(req.query.year, 10) : currentYear;

  if (Number.isNaN(year)) {
    return res.status(400).json({ error: "Invalid year parameter" });
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
    res.status(500).json({ error: err.message });
  }
});

// GET all habit completions for a given year (bulk load)
router.get("/completions", async (req, res) => {
  const currentYear = new Date().getFullYear();
  const year = req.query.year ? parseInt(req.query.year, 10) : currentYear;

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
    res.status(500).json({ error: err.message });
  }
});

// POST create a new habit
router.post("/", async (req, res) => {
  const { title, color, icon, year } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("habits")
      .insert({
        user_id: req.userId,
        title: title.trim(),
        color: color || null,
        icon: icon || null,
        year: targetYear,
        archived: false,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatHabit(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update habit (title, color, icon, archived)
router.patch("/:id", async (req, res) => {
  const { title, color, icon, archived } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (color !== undefined) updates.color = color;
  if (icon !== undefined) updates.icon = icon;
  if (archived !== undefined) updates.archived = archived;

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
    res.status(500).json({ error: err.message });
  }
});

// DELETE habit
router.delete("/:id", async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// GET completions for a single habit
router.get("/:id/completions", async (req, res) => {
  const currentYear = new Date().getFullYear();
  const year = req.query.year ? parseInt(req.query.year, 10) : currentYear;
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const db = req.supabase || supabase;
  try {
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle or set completion for a specific habit and date
router.patch("/:id/completions", async (req, res) => {
  const { date, completed } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
  }

  const isCompleted = completed !== undefined ? Boolean(completed) : true;

  const db = req.supabase || supabase;
  try {
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
