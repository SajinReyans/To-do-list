import { Router } from "express";
import { supabase } from "../supabase.js";
import {
  validateUUIDParam,
  isValidDate,
  isValidPriority,
  sanitizeTitle,
} from "../middleware/validation.js";

const router = Router();

// Fallback in-memory store for environments where Supabase is not configured / during offline tests
const inMemoryTodayStore = new Map(); // key: userId, value: array of tasks

function getInMemoryTasks(userId) {
  if (!inMemoryTodayStore.has(userId)) {
    inMemoryTodayStore.set(userId, []);
  }
  return inMemoryTodayStore.get(userId);
}

function formatTodayTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    priority: row.priority || "none",
    checked: Boolean(row.checked),
    order: row.order ?? 0,
    createdAt: row.created_at,
  };
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// GET all tasks for a specific date (defaults to today)
router.get("/", async (req, res) => {
  let targetDate = getTodayString();
  if (req.query.date !== undefined) {
    if (!isValidDate(req.query.date)) {
      return res.status(400).json({ error: "Invalid date parameter (format: YYYY-MM-DD)" });
    }
    targetDate = req.query.date;
  }

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("today_tasks")
      .select("*")
      .eq("user_id", req.userId)
      .eq("date", targetDate)
      .order("order", { ascending: true });

    if (error) {
      // If table does not exist or Supabase offline, fallback gracefully
      if (error.code === "42P01" || error.message?.includes("does not exist") || !process.env.SUPABASE_URL) {
        const memTasks = getInMemoryTasks(req.userId).filter((t) => t.date === targetDate);
        return res.json(memTasks.map(formatTodayTask));
      }
      throw error;
    }
    res.json((data || []).map(formatTodayTask));
  } catch (err) {
    // If Supabase connection fails, check fallback
    if (!process.env.SUPABASE_URL || process.env.NODE_ENV === "test") {
      const memTasks = getInMemoryTasks(req.userId).filter((t) => t.date === targetDate);
      return res.json(memTasks.map(formatTodayTask));
    }
    console.error(`[${new Date().toISOString()}] Error fetching today tasks:`, err.message);
    res.status(500).json({ error: "Failed to fetch today tasks" });
  }
});

// POST create a new today task
router.post("/", async (req, res) => {
  const title = sanitizeTitle(req.body?.title);
  if (!title) {
    return res.status(400).json({ error: "Title is required (maximum 500 characters)" });
  }

  let date = getTodayString();
  if (req.body?.date !== undefined) {
    if (!isValidDate(req.body.date)) {
      return res.status(400).json({ error: "Invalid date parameter (format: YYYY-MM-DD)" });
    }
    date = req.body.date;
  }

  let priority = "none";
  if (req.body?.priority !== undefined) {
    if (!isValidPriority(req.body.priority)) {
      return res.status(400).json({ error: "Invalid priority (must be 'high', 'medium', 'low', or 'none')" });
    }
    priority = req.body.priority.toLowerCase();
  }

  const db = req.supabase || supabase;
  try {
    // Get next order for this user and date
    const { data: maxRow } = await db
      .from("today_tasks")
      .select("order")
      .eq("user_id", req.userId)
      .eq("date", date)
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = maxRow && maxRow.order !== null ? maxRow.order + 1 : 0;

    const { data, error } = await db
      .from("today_tasks")
      .insert({
        user_id: req.userId,
        title,
        date,
        priority,
        checked: false,
        order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist") || !process.env.SUPABASE_URL) {
        const memTasks = getInMemoryTasks(req.userId);
        const nextId = crypto.randomUUID();
        const newTask = {
          id: nextId,
          user_id: req.userId,
          title,
          date,
          priority,
          checked: false,
          order: memTasks.length,
          created_at: new Date().toISOString(),
        };
        memTasks.push(newTask);
        return res.status(201).json(formatTodayTask(newTask));
      }
      throw error;
    }

    res.status(201).json(formatTodayTask(data));
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.NODE_ENV === "test") {
      const memTasks = getInMemoryTasks(req.userId);
      const nextId = crypto.randomUUID();
      const newTask = {
        id: nextId,
        user_id: req.userId,
        title,
        date,
        priority,
        checked: false,
        order: memTasks.length,
        created_at: new Date().toISOString(),
      };
      memTasks.push(newTask);
      return res.status(201).json(formatTodayTask(newTask));
    }
    console.error(`[${new Date().toISOString()}] Error creating today task:`, err.message);
    res.status(500).json({ error: "Failed to create today task" });
  }
});

// PATCH update a today task (toggle checked, edit title/priority/date/order)
router.patch("/:id", validateUUIDParam("id"), async (req, res) => {
  const updates = {};

  if (req.body.title !== undefined) {
    const title = sanitizeTitle(req.body.title);
    if (!title) {
      return res.status(400).json({ error: "Title cannot be empty (maximum 500 characters)" });
    }
    updates.title = title;
  }

  if (req.body.priority !== undefined) {
    if (!isValidPriority(req.body.priority)) {
      return res.status(400).json({ error: "Invalid priority (must be 'high', 'medium', 'low', or 'none')" });
    }
    updates.priority = req.body.priority.toLowerCase();
  }

  if (req.body.checked !== undefined) {
    if (typeof req.body.checked !== "boolean") {
      return res.status(400).json({ error: "Checked must be a boolean" });
    }
    updates.checked = req.body.checked;
  }

  if (req.body.date !== undefined) {
    if (!isValidDate(req.body.date)) {
      return res.status(400).json({ error: "Invalid date format (YYYY-MM-DD)" });
    }
    updates.date = req.body.date;
  }

  if (req.body.order !== undefined) {
    if (typeof req.body.order !== "number" || !Number.isInteger(req.body.order)) {
      return res.status(400).json({ error: "Order must be an integer" });
    }
    updates.order = req.body.order;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid update fields provided" });
  }

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("today_tasks")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist") || !process.env.SUPABASE_URL) {
        const memTasks = getInMemoryTasks(req.userId);
        const task = memTasks.find((t) => t.id === req.params.id);
        if (!task) return res.status(404).json({ error: "Task not found" });
        Object.assign(task, updates);
        return res.json(formatTodayTask(task));
      }
      throw error;
    }

    if (!data) return res.status(404).json({ error: "Task not found" });
    res.json(formatTodayTask(data));
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.NODE_ENV === "test") {
      const memTasks = getInMemoryTasks(req.userId);
      const task = memTasks.find((t) => t.id === req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      Object.assign(task, updates);
      return res.json(formatTodayTask(task));
    }
    console.error(`[${new Date().toISOString()}] Error updating today task:`, err.message);
    res.status(500).json({ error: "Failed to update today task" });
  }
});

// DELETE a today task
router.delete("/:id", validateUUIDParam("id"), async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("today_tasks")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist") || !process.env.SUPABASE_URL) {
        const memTasks = getInMemoryTasks(req.userId);
        const idx = memTasks.findIndex((t) => t.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: "Task not found" });
        memTasks.splice(idx, 1);
        return res.status(204).end();
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(204).end();
  } catch (err) {
    if (!process.env.SUPABASE_URL || process.env.NODE_ENV === "test") {
      const memTasks = getInMemoryTasks(req.userId);
      const idx = memTasks.findIndex((t) => t.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Task not found" });
      memTasks.splice(idx, 1);
      return res.status(204).end();
    }
    console.error(`[${new Date().toISOString()}] Error deleting today task:`, err.message);
    res.status(500).json({ error: "Failed to delete today task" });
  }
});

export default router;
