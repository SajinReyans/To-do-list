import { Router } from "express";
import { nanoid } from "nanoid";
import { readDb, writeDb } from "../store.js";

const router = Router();

function buildTree(nodes, parentId = null) {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((n) => ({ ...n, children: buildTree(nodes, n.id) }));
}

function getDescendantIds(nodes, id) {
  const direct = nodes.filter((n) => n.parentId === id);
  let all = direct.map((n) => n.id);
  for (const child of direct) {
    all = all.concat(getDescendantIds(nodes, child.id));
  }
  return all;
}

// After setting a node's checked value, cascade down to all descendants,
// then bubble up: a parent is checked only if ALL of its children are checked.
function cascade(nodes, id, checked) {
  const descendants = getDescendantIds(nodes, id);
  for (const node of nodes) {
    if (node.id === id || descendants.includes(node.id)) {
      node.checked = checked;
    }
  }
  bubbleUp(nodes, id);
}

function bubbleUp(nodes, id) {
  const node = nodes.find((n) => n.id === id);
  if (!node || !node.parentId) return;
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) return;
  const siblings = nodes.filter((n) => n.parentId === parent.id);
  parent.checked = siblings.length > 0 && siblings.every((s) => s.checked);
  bubbleUp(nodes, parent.id);
}

// GET full tree (nested)
router.get("/", async (req, res) => {
  const db = await readDb();
  res.json(buildTree(db.treeNodes, null));
});

// POST create a node (group or task). parentId null = root group.
router.post("/", async (req, res) => {
  const { title, parentId, deadline } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  const db = await readDb();
  const siblingMax = db.treeNodes
    .filter((n) => n.parentId === (parentId || null))
    .reduce((m, n) => Math.max(m, n.order), -1);
  const node = {
    id: nanoid(),
    title: title.trim(),
    parentId: parentId || null,
    deadline: deadline || null,
    checked: false,
    order: siblingMax + 1,
    createdAt: new Date().toISOString(),
  };
  db.treeNodes.push(node);
  await writeDb(db);
  res.status(201).json(node);
});

// PATCH update a node. Setting `checked` cascades to descendants + bubbles up.
router.patch("/:id", async (req, res) => {
  const db = await readDb();
  const node = db.treeNodes.find((n) => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: "Node not found" });
  const { title, deadline, checked } = req.body;
  if (title !== undefined) node.title = title;
  if (deadline !== undefined) node.deadline = deadline;
  if (checked !== undefined) cascade(db.treeNodes, node.id, checked);
  await writeDb(db);
  res.json(buildTree(db.treeNodes, null));
});

// DELETE a node and all its descendants
router.delete("/:id", async (req, res) => {
  const db = await readDb();
  const descendants = getDescendantIds(db.treeNodes, req.params.id);
  const toRemove = new Set([req.params.id, ...descendants]);
  const before = db.treeNodes.length;
  db.treeNodes = db.treeNodes.filter((n) => !toRemove.has(n.id));
  if (db.treeNodes.length === before) {
    return res.status(404).json({ error: "Node not found" });
  }
  // Re-bubble parent state after removal
  await writeDb(db);
  res.json(buildTree(db.treeNodes, null));
});

export default router;
