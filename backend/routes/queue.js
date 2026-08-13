import { Router } from "express";
import { nanoid } from "nanoid";
import { readDb, writeDb } from "../store.js";

const router = Router();

// GET all queue tasks, ordered left-to-right
router.get("/", async (req, res) => {
  const db = await readDb();
  const tasks = [...db.queueTasks].sort((a, b) => a.order - b.order);
  res.json(tasks);
});

// POST create a new queue task (added to the right end)
router.post("/", async (req, res) => {
  const { title, deadline } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const db = await readDb();
  const maxOrder = db.queueTasks.reduce((m, t) => Math.max(m, t.order), -1);
  const task = {
    id: nanoid(),
    title: title.trim(),
    deadline: deadline || null,
    checked: false,
    order: maxOrder + 1,
    createdAt: new Date().toISOString(),
  };
  db.queueTasks.push(task);
  await writeDb(db);
  res.status(201).json(task);
});

// PATCH update a queue task (toggle checked, edit title/deadline)
router.patch("/:id", async (req, res) => {
  const db = await readDb();
  const task = db.queueTasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  const { title, deadline, checked } = req.body;
  if (title !== undefined) task.title = title;
  if (deadline !== undefined) task.deadline = deadline;
  if (checked !== undefined) task.checked = checked;
  await writeDb(db);
  res.json(task);
});

// DELETE a queue task
router.delete("/:id", async (req, res) => {
  const db = await readDb();
  const before = db.queueTasks.length;
  db.queueTasks = db.queueTasks.filter((t) => t.id !== req.params.id);
  if (db.queueTasks.length === before) {
    return res.status(404).json({ error: "Task not found" });
  }
  await writeDb(db);
  res.status(204).end();
});

export default router;
