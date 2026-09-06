import { Router } from "express";
import { supabase } from "../supabase.js";
import { validateUUIDParam, isValidUUID, sanitizeTitle } from "../middleware/validation.js";

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
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error fetching tree:`, err.message);
    }
    res.status(500).json({ error: "Failed to fetch tree nodes" });
  }
});

// POST create a node (group or task). parentId null = root group.
router.post("/", async (req, res) => {
  const title = sanitizeTitle(req.body?.title);
  if (!title) {
    return res.status(400).json({ error: "Title is required (maximum 500 characters)" });
  }

  const parentId = req.body?.parentId || null;
  if (parentId !== null && !isValidUUID(parentId)) {
    return res.status(400).json({ error: "Invalid parentId format: must be a valid UUID" });
  }

  const deadline =
    typeof req.body?.deadline === "string" && req.body.deadline.trim().length <= 50
      ? req.body.deadline.trim()
      : null;

  const db = req.supabase || supabase;
  try {
    // IDOR Prevention: If parentId is provided, verify it exists and belongs to the authenticated user
    if (parentId) {
      const { data: parentNode, error: parentCheckError } = await db
        .from("tree_nodes")
        .select("id")
        .eq("id", parentId)
        .eq("user_id", req.userId)
        .maybeSingle();

      if (parentCheckError) throw parentCheckError;
      if (!parentNode) {
        return res.status(404).json({ error: "Parent node not found or access denied" });
      }
    }

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
        title,
        parent_id: parentId,
        deadline,
        checked: false,
        order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(formatNode(data));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error creating tree node:`, err.message);
    }
    res.status(500).json({ error: "Failed to create tree node" });
  }
});

// PATCH update a node. Setting `checked` cascades to descendants + bubbles up.
router.patch("/:id", validateUUIDParam("id"), async (req, res) => {
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

    const { title, deadline, checked } = req.body || {};

    if (title !== undefined) {
      const sanitized = sanitizeTitle(title);
      if (!sanitized) {
        return res.status(400).json({ error: "Title cannot be empty (maximum 500 characters)" });
      }
      targetNode.title = sanitized;
    }

    if (deadline !== undefined) {
      targetNode.deadline =
        typeof deadline === "string" && deadline.trim().length <= 50 ? deadline.trim() : null;
    }

    if (checked !== undefined) {
      if (typeof checked !== "boolean") {
        return res.status(400).json({ error: "Checked must be a boolean" });
      }
      cascade(nodes, targetNode.id, checked);
    }

    // Identify changed nodes to update in database
    const originalMap = new Map((rows || []).map((r) => [r.id, formatNode(r)]));
    const updates = nodes.filter((n) => {
      const orig = originalMap.get(n.id);
      return orig && (orig.checked !== n.checked || orig.title !== n.title || orig.deadline !== n.deadline);
    });

    if (updates.length > 0) {
      const results = await Promise.all(
        updates.map((n) =>
          db
            .from("tree_nodes")
            .update({
              title: n.title,
              deadline: n.deadline,
              checked: n.checked,
            })
            .eq("id", n.id)
            .eq("user_id", req.userId)
        )
      );
      const firstErr = results.find((r) => r && r.error)?.error;
      if (firstErr) throw firstErr;
    }

    res.json(buildTree(nodes, null));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error updating tree node:`, err.message);
    }
    res.status(500).json({ error: "Failed to update tree node" });
  }
});

// DELETE a node and all its descendants
router.delete("/:id", validateUUIDParam("id"), async (req, res) => {
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

      if (parentUpdates.length > 0) {
        await Promise.all(
          parentUpdates.map((n) =>
            db
              .from("tree_nodes")
              .update({ checked: n.checked })
              .eq("id", n.id)
              .eq("user_id", req.userId)
          )
        );
      }
    }

    res.json(buildTree(remainingNodes, null));
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${new Date().toISOString()}] Error deleting tree node:`, err.message);
    }
    res.status(500).json({ error: "Failed to delete tree node" });
  }
});

export default router;
