import { Router } from "express";
import { supabase } from "../supabase.js";
import { validateUUIDParam, isValidDate, isValidYear, sanitizeTitle } from "../middleware/validation.js";
import { sendHabitReminder } from "../services/mailer.js";
import { checkRemindersNow } from "../services/reminderScheduler.js";

const router = Router();

// In-memory fallback stores for development and tests when Supabase is offline/unconfigured
export const inMemoryHabits = new Map(); // userId -> habit[]
export const inMemoryCompletions = new Map(); // habitId -> { [date]: boolean }

function getMemHabits(userId) {
  if (!inMemoryHabits.has(userId)) {
    inMemoryHabits.set(userId, []);
  }
  return inMemoryHabits.get(userId);
}

function getMemCompletions(habitId) {
  if (!inMemoryCompletions.has(habitId)) {
    inMemoryCompletions.set(habitId, {});
  }
  return inMemoryCompletions.get(habitId);
}

function formatHabit(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    color: row.color || null,
    icon: row.icon || null,
    year: row.year,
    archived: Boolean(row.archived),
    reminderEnabled: Boolean(row.reminder_enabled),
    reminderTime: row.reminder_time || "20:00",
    reminderMessage: row.reminder_message || "",
    reminderEmail: row.reminder_email || null,
    lastRemindedDate: row.last_reminded_date || null,
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

    if (error) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder") || error.code === "42P01") {
        const mem = getMemHabits(req.userId).filter((h) => h.year === year && !h.archived);
        return res.json(mem.map(formatHabit));
      }
      throw error;
    }

    // Automatic Year Rollover
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
            reminder_enabled: h.reminder_enabled ?? false,
            reminder_time: h.reminder_time ?? "20:00",
            reminder_message: h.reminder_message ?? null,
            reminder_email: h.reminder_email ?? null,
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
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = getMemHabits(req.userId).filter((h) => h.year === year && !h.archived);
      return res.json(mem.map(formatHabit));
    }
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

    if (error) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder") || error.code === "42P01") {
        const mem = {};
        const userHabits = getMemHabits(req.userId);
        for (const h of userHabits) {
          mem[h.id] = getMemCompletions(h.id);
        }
        return res.json(mem);
      }
      throw error;
    }

    const completionsMap = {};
    for (const row of data || []) {
      if (!completionsMap[row.habit_id]) {
        completionsMap[row.habit_id] = {};
      }
      completionsMap[row.habit_id][row.date] = row.completed;
    }

    res.json(completionsMap);
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = {};
      const userHabits = getMemHabits(req.userId);
      for (const h of userHabits) {
        mem[h.id] = getMemCompletions(h.id);
      }
      return res.json(mem);
    }
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

  const reminderEnabled = Boolean(req.body?.reminderEnabled);
  const reminderTime =
    typeof req.body?.reminderTime === "string" && /^\d{1,2}:\d{2}$/.test(req.body.reminderTime.trim())
      ? req.body.reminderTime.trim()
      : "20:00";
  const reminderMessage =
    typeof req.body?.reminderMessage === "string" ? req.body.reminderMessage.trim().slice(0, 1000) : "";
  const reminderEmail =
    typeof req.body?.reminderEmail === "string" && req.body.reminderEmail.includes("@")
      ? req.body.reminderEmail.trim().toLowerCase()
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
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime,
        reminder_message: reminderMessage || null,
        reminder_email: reminderEmail,
      })
      .select()
      .single();

    if (error) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder") || error.code === "42P01") {
        const mem = getMemHabits(req.userId);
        const newHabit = {
          id: crypto.randomUUID(),
          user_id: req.userId,
          title,
          color,
          icon,
          year: targetYear,
          archived: false,
          reminder_enabled: reminderEnabled,
          reminder_time: reminderTime,
          reminder_message: reminderMessage || null,
          reminder_email: reminderEmail,
          last_reminded_date: null,
          created_at: new Date().toISOString(),
        };
        mem.push(newHabit);
        return res.status(201).json(formatHabit(newHabit));
      }
      throw error;
    }
    res.status(201).json(formatHabit(data));
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = getMemHabits(req.userId);
      const newHabit = {
        id: crypto.randomUUID(),
        user_id: req.userId,
        title,
        color,
        icon,
        year: targetYear,
        archived: false,
        reminder_enabled: reminderEnabled,
        reminder_time: reminderTime,
        reminder_message: reminderMessage || null,
        reminder_email: reminderEmail,
        last_reminded_date: null,
        created_at: new Date().toISOString(),
      };
      mem.push(newHabit);
      return res.status(201).json(formatHabit(newHabit));
    }
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error creating habit:`, err.message);
    }
    res.status(500).json({ error: "Failed to create habit" });
  }
});

// PATCH update habit (title, color, icon, archived, reminder settings)
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

  // Reminder settings updates
  if (req.body?.reminderEnabled !== undefined) {
    if (typeof req.body.reminderEnabled !== "boolean") {
      return res.status(400).json({ error: "reminderEnabled must be a boolean" });
    }
    updates.reminder_enabled = req.body.reminderEnabled;
  }

  if (req.body?.reminderTime !== undefined) {
    const timeStr = String(req.body.reminderTime).trim();
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
      return res.status(400).json({ error: "reminderTime must be in HH:MM 24-hour format" });
    }
    updates.reminder_time = timeStr;
  }

  if (req.body?.reminderMessage !== undefined) {
    updates.reminder_message =
      typeof req.body.reminderMessage === "string" ? req.body.reminderMessage.trim().slice(0, 1000) : "";
  }

  if (req.body?.reminderEmail !== undefined) {
    updates.reminder_email =
      typeof req.body.reminderEmail === "string" && req.body.reminderEmail.includes("@")
        ? req.body.reminderEmail.trim().toLowerCase()
        : null;
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

    if (error) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder") || error.code === "42P01") {
        const mem = getMemHabits(req.userId);
        const habit = mem.find((h) => h.id === req.params.id);
        if (!habit) return res.status(404).json({ error: "Habit not found" });
        Object.assign(habit, updates);
        return res.json(formatHabit(habit));
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: "Habit not found" });

    res.json(formatHabit(data));
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = getMemHabits(req.userId);
      const habit = mem.find((h) => h.id === req.params.id);
      if (!habit) return res.status(404).json({ error: "Habit not found" });
      Object.assign(habit, updates);
      return res.json(formatHabit(habit));
    }
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

    if (error) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder") || error.code === "42P01") {
        const mem = getMemHabits(req.userId);
        const idx = mem.findIndex((h) => h.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: "Habit not found" });
        mem.splice(idx, 1);
        return res.status(204).end();
      }
      throw error;
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Habit not found" });
    }

    res.status(204).end();
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = getMemHabits(req.userId);
      const idx = mem.findIndex((h) => h.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Habit not found" });
      mem.splice(idx, 1);
      return res.status(204).end();
    }
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
    const { data: habit, error: habitError } = await db
      .from("habits")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .maybeSingle();

    if (habitError) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
        const mem = getMemHabits(req.userId);
        const exists = mem.some((h) => h.id === req.params.id);
        if (!exists) return res.status(404).json({ error: "Habit not found" });
        return res.json(getMemCompletions(req.params.id));
      }
      throw habitError;
    }
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
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = getMemHabits(req.userId);
      const exists = mem.some((h) => h.id === req.params.id);
      if (!exists) return res.status(404).json({ error: "Habit not found" });
      return res.json(getMemCompletions(req.params.id));
    }
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
    const { data: habit, error: habitCheckError } = await db
      .from("habits")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .maybeSingle();

    if (habitCheckError) {
      if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
        const mem = getMemHabits(req.userId);
        const exists = mem.some((h) => h.id === req.params.id);
        if (!exists) return res.status(404).json({ error: "Habit not found or access denied" });
        const completions = getMemCompletions(req.params.id);
        completions[date] = isCompleted;
        return res.json({ date, completed: isCompleted });
      }
      throw habitCheckError;
    }
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
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes("placeholder")) {
      const mem = getMemHabits(req.userId);
      const exists = mem.some((h) => h.id === req.params.id);
      if (!exists) return res.status(404).json({ error: "Habit not found or access denied" });
      const completions = getMemCompletions(req.params.id);
      completions[date] = isCompleted;
      return res.json({ date, completed: isCompleted });
    }
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error updating habit completion:`, err.message);
    }
    res.status(500).json({ error: "Failed to update habit completion" });
  }
});

// POST send immediate test reminder email for a habit
router.post("/:id/test-reminder", validateUUIDParam("id"), async (req, res) => {
  const db = req.supabase || supabase;
  try {
    let habit = null;

    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("placeholder")) {
      const { data, error } = await db
        .from("habits")
        .select("*")
        .eq("id", req.params.id)
        .eq("user_id", req.userId)
        .maybeSingle();

      if (error) throw error;
      habit = data;
    } else {
      const mem = getMemHabits(req.userId);
      habit = mem.find((h) => h.id === req.params.id);
    }

    if (!habit) {
      return res.status(404).json({ error: "Habit not found" });
    }

    const recipient =
      (req.body?.email && req.body.email.trim()) ||
      habit.reminder_email ||
      req.user?.email ||
      `${req.userId}@aloft.local`;

    const customMessage =
      req.body?.customMessage !== undefined
        ? String(req.body.customMessage).trim()
        : habit.reminder_message;

    const result = await sendHabitReminder({
      to: recipient,
      habitTitle: habit.title,
      habitIcon: habit.icon || "🎯",
      deadlineTime: habit.reminder_time || "20:00",
      customMessage: customMessage || "You haven't done anything about this habit today! Complete it before midnight.",
      isTest: true,
    });

    res.json({
      ok: true,
      recipient,
      message: `Test reminder email successfully sent to ${recipient}!`,
      previewUrl: result.previewUrl,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error sending test reminder:`, err.message);
    }
    res.status(500).json({ error: err.message || "Failed to send test reminder email" });
  }
});

// POST manually trigger scan of habit reminders
router.post("/check-reminders", async (req, res) => {
  try {
    const result = await checkRemindersNow(inMemoryHabits, inMemoryCompletions);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger reminder check" });
  }
});

export default router;
