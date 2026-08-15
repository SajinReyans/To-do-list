import { Router } from "express";
import { supabase } from "../supabase.js";

const router = Router();

function formatNode(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    parentId: row.parent_id,
    deadline: row.deadline,
    checked: row.checked,
    order: row.order,
    createdAt: row.created_at,
  };
}

function buildTree(nodes, parentId = null) {
  return nodes
    .filter((n) => (n.parentId ?? null) === (parentId ?? null))
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
  const db = req.supabase || supabase;
  try {
    const { data, error } = await db
      .from("tree_nodes")
      .select("*")
      .eq("user_id", req.userId)
      .order("order", { ascending: true });

    if (error) throw error;
    const formatted = (data || []).map(formatNode);
    res.json(buildTree(formatted, null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a node (group or task). parentId null = root group.
router.post("/", async (req, res) => {
  const { title, parentId, deadline } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const db = req.supabase || supabase;
  try {
    // Find max order among siblings
    let query = db
      .from("tree_nodes")
      .select("order")
      .eq("user_id", req.userId);

    if (parentId) {
      query = query.eq("parent_id", parentId);
    } else {
      query = query.is("parent_id", null);
    }

    const { data: maxRow, error: maxError } = await query
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) throw maxError;

    const nextOrder = maxRow && maxRow.order !== null ? maxRow.order + 1 : 0;

    const { data, error } = await db
      .from("tree_nodes")
      .insert({
        user_id: req.userId,
        title: title.trim(),
        parent_id: parentId || null,
        deadline: deadline || null,
        checked: false,
        order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatNode(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update a node. Setting `checked` cascades to descendants + bubbles up.
router.patch("/:id", async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data: rows, error: fetchError } = await db
      .from("tree_nodes")
      .select("*")
      .eq("user_id", req.userId);

    if (fetchError) throw fetchError;

    const nodes = (rows || []).map(formatNode);
    const targetNode = nodes.find((n) => n.id === req.params.id);
    if (!targetNode) return res.status(404).json({ error: "Node not found" });

    const { title, deadline, checked } = req.body;
    if (title !== undefined) targetNode.title = title;
    if (deadline !== undefined) targetNode.deadline = deadline;
    if (checked !== undefined) cascade(nodes, targetNode.id, checked);

    // Identify changed nodes to update in Supabase
    const originalMap = new Map((rows || []).map((r) => [r.id, formatNode(r)]));
    const updates = nodes.filter((n) => {
      const orig = originalMap.get(n.id);
      return orig && (orig.checked !== n.checked || orig.title !== n.title || orig.deadline !== n.deadline);
    });

    for (const n of updates) {
      await db
        .from("tree_nodes")
        .update({
          title: n.title,
          deadline: n.deadline,
          checked: n.checked,
        })
        .eq("id", n.id)
        .eq("user_id", req.userId);
    }

    res.json(buildTree(nodes, null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a node and all its descendants
router.delete("/:id", async (req, res) => {
  const db = req.supabase || supabase;
  try {
    const { data: rows, error: fetchError } = await db
      .from("tree_nodes")
      .select("*")
      .eq("user_id", req.userId);

    if (fetchError) throw fetchError;

    const nodes = (rows || []).map(formatNode);
    const targetNode = nodes.find((n) => n.id === req.params.id);
    if (!targetNode) {
      return res.status(404).json({ error: "Node not found" });
    }

    const descendants = getDescendantIds(nodes, req.params.id);
    const toRemove = new Set([req.params.id, ...descendants]);
    const remainingNodes = nodes.filter((n) => !toRemove.has(n.id));

    // Delete node and its descendants
    const { error: deleteError } = await db
      .from("tree_nodes")
      .delete()
      .in("id", Array.from(toRemove))
      .eq("user_id", req.userId);

    if (deleteError) throw deleteError;

    // If target had a parent, re-bubble checked state up in remaining nodes
    if (targetNode.parentId) {
      bubbleUp(remainingNodes, targetNode.parentId);

      const originalMap = new Map((rows || []).map((r) => [r.id, formatNode(r)]));
      const parentUpdates = remainingNodes.filter((n) => {
        const orig = originalMap.get(n.id);
        return orig && orig.checked !== n.checked;
      });

      for (const n of parentUpdates) {
        await db
          .from("tree_nodes")
          .update({ checked: n.checked })
          .eq("id", n.id)
          .eq("user_id", req.userId);
      }
    }

    res.json(buildTree(remainingNodes, null));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
