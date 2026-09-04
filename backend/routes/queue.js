import { Router } from "express";
import { supabase } from "../supabase.js";
import { validateUUIDParam, sanitizeTitle } from "../middleware/validation.js";

const router = Router();

function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    deadline: row.deadline,
    checked: row.checked,
    order: row.order,
    createdAt: row.created_at,
  };
}

// GET all queue tasks for the authenticated user, ordered left-to-right
router.get("/", async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("queue_tasks")
      .select("*")
      .eq("user_id", req.userId)
      .order("order", { ascending: true });

    if (error) throw error;
    res.json((data || []).map(formatTask));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error fetching queue tasks:`, err.message);
    }
    res.status(500).json({ error: "Failed to fetch queue tasks" });
  }
});

// POST create a new queue task (added to the right end)
router.post("/", async (req, res) => {
  const title = sanitizeTitle(req.body?.title);
  if (!title) {
    return res.status(400).json({ error: "Title is required (maximum 500 characters)" });
  }

  const deadline = typeof req.body.deadline === "string" && req.body.deadline.trim().length <= 50
    ? req.body.deadline.trim()
    : null;

  const db = req.supabase || supabase;
  try {
    // Find current max order for this user
    const { data: maxRow, error: maxError } = await db
      .from("queue_tasks")
      .select("order")
      .eq("user_id", req.userId)
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) throw maxError;

    const nextOrder = maxRow && maxRow.order !== null ? maxRow.order + 1 : 0;

    const { data, error } = await db
      .from("queue_tasks")
      .insert({
        user_id: req.userId,
        title,
        deadline,
        checked: false,
        order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatTask(data));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error creating queue task:`, err.message);
    }
    res.status(500).json({ error: "Failed to create queue task" });
  }
});

// PATCH update a queue task (toggle checked, edit title/deadline)
router.patch("/:id", validateUUIDParam("id"), async (req, res) => {
  const updates = {};
  
  if (req.body.title !== undefined) {
    const title = sanitizeTitle(req.body.title);
    if (!title) {
      return res.status(400).json({ error: "Title cannot be empty (maximum 500 characters)" });
    }
    updates.title = title;
  }

  if (req.body.deadline !== undefined) {
    updates.deadline =
      typeof req.body.deadline === "string" && req.body.deadline.trim().length <= 50
        ? req.body.deadline.trim()
        : null;
  }

  if (req.body.checked !== undefined) {
    if (typeof req.body.checked !== "boolean") {
      return res.status(400).json({ error: "Checked must be a boolean" });
    }
    updates.checked = req.body.checked;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid update fields provided" });
  }

  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("queue_tasks")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Task not found" });

    res.json(formatTask(data));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error updating queue task:`, err.message);
    }
    res.status(500).json({ error: "Failed to update queue task" });
  }
});

// DELETE a queue task
router.delete("/:id", validateUUIDParam("id"), async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("queue_tasks")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.userId)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(204).end();
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error deleting queue task:`, err.message);
    }
    res.status(500).json({ error: "Failed to delete queue task" });
  }
});

export default router;
