import { Router } from "express";
import { supabase } from "../supabase.js";

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
    res.status(500).json({ error: err.message });
  }
});

// POST create a new queue task (added to the right end)
router.post("/", async (req, res) => {
  const { title, deadline } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

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
        title: title.trim(),
        deadline: deadline || null,
        checked: false,
        order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatTask(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update a queue task (toggle checked, edit title/deadline)
router.patch("/:id", async (req, res) => {
  const { title, deadline, checked } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (deadline !== undefined) updates.deadline = deadline;
  if (checked !== undefined) updates.checked = checked;

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
    res.status(500).json({ error: err.message });
  }
});

// DELETE a queue task
router.delete("/:id", async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

export default router;
