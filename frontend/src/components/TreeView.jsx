import { useEffect, useState, useCallback } from "react";
import TreeNode from "./TreeNode.jsx";
import { getTree, createTreeNode, updateTreeNode, deleteTreeNode } from "../api.js";

function updateNodeInTree(nodes, id, checked) {
  function cloneAndCascade(list) {
    return list.map((node) => {
      if (node.id === id) {
        return setAllChecked(node, checked);
      }
      if (node.children?.length) {
        const updatedChildren = cloneAndCascade(node.children);
        const allChecked = updatedChildren.length > 0 && updatedChildren.every((c) => c.checked);
        return { ...node, children: updatedChildren, checked: allChecked };
      }
      return node;
    });
  }

  function setAllChecked(node, val) {
    return {
      ...node,
      checked: val,
      children: node.children ? node.children.map((c) => setAllChecked(c, val)) : [],
    };
  }

  return cloneAndCascade(nodes);
}

export default function TreeView() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupTitle, setGroupTitle] = useState("");

  const load = useCallback(() => {
    getTree()
      .then((data) => setTree(data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddGroup = async (e) => {
    e.preventDefault();
    const cleanTitle = groupTitle.trim();
    if (!cleanTitle) return;

    const tempId = `temp-g-${Date.now()}`;
    const optimisticGroup = {
      id: tempId,
      title: cleanTitle,
      parentId: null,
      deadline: null,
      checked: false,
      children: [],
      order: tree.length,
      createdAt: new Date().toISOString(),
    };

    setTree((prev) => [...prev, optimisticGroup]);
    setGroupTitle("");

    try {
      const created = await createTreeNode({ title: cleanTitle, parentId: null });
      setTree((prev) => prev.map((n) => (n.id === tempId ? { ...created, children: [] } : n)));
    } catch (e) {
      setTree((prev) => prev.filter((n) => n.id !== tempId));
      setError(e.message);
    }
  };

  const handleAddChild = async (parentId, title, deadline) => {
    const tempId = `temp-c-${Date.now()}`;
    const optimisticChild = {
      id: tempId,
      title,
      parentId,
      deadline: deadline || null,
      checked: false,
      children: [],
      createdAt: new Date().toISOString(),
    };

    function insertChild(nodes) {
      return nodes.map((n) => {
        if (n.id === parentId) {
          return {
            ...n,
            checked: false,
            children: [...(n.children || []), optimisticChild],
          };
        }
        if (n.children?.length) {
          return { ...n, children: insertChild(n.children) };
        }
        return n;
      });
    }

    setTree((prev) => insertChild(prev));

    try {
      const created = await createTreeNode({ title, parentId, deadline });
      function replaceTemp(nodes) {
        return nodes.map((n) => {
          if (n.id === tempId) return { ...created, children: [] };
          if (n.children?.length) return { ...n, children: replaceTemp(n.children) };
          return n;
        });
      }
      setTree((prev) => replaceTemp(prev));
    } catch (e) {
      load();
      setError(e.message);
    }
  };

  const handleToggle = async (id, checked) => {
    const backup = tree;
    setTree((prev) => updateNodeInTree(prev, id, checked));
    try {
      const updated = await updateTreeNode(id, { checked });
      if (updated) setTree(updated);
    } catch (e) {
      setTree(backup);
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    const backup = tree;
    function removeNode(nodes) {
      return nodes
        .filter((n) => n.id !== id)
        .map((n) => (n.children ? { ...n, children: removeNode(n.children) } : n));
    }
    setTree((prev) => removeNode(prev));
    try {
      const updated = await deleteTreeNode(id);
      if (updated) setTree(updated);
    } catch (e) {
      setTree(backup);
      setError(e.message);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Tree
        </h2>
        <p className="text-sm" style={{ color: "var(--text-soft)" }}>
          Long-term goals, branched into steps. Check a group and every task beneath it checks too.
        </p>
      </div>

      <form onSubmit={handleAddGroup} className="flex gap-2">
        <input
          value={groupTitle}
          onChange={(e) => setGroupTitle(e.target.value)}
          placeholder="New group, e.g. Programming languages…"
          className="flex-1 rounded-xl px-4 py-2.5 border-2 bg-white/70 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 font-semibold text-white"
          style={{ backgroundColor: "var(--accent)" }}
        >
          New group
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-soft)" }}>Loading…</p>
      ) : tree.length === 0 ? (
        <div
          className="rounded-3xl border-2 border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
        >
          No groups yet — create one above (e.g. "Programming languages") then add children like HTML and CSS.
        </div>
      ) : (
        <div
          className="rounded-3xl p-6 flex flex-col gap-4 overflow-x-auto"
          style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
        >
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              onToggle={handleToggle}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
