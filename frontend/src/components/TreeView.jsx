import { useEffect, useState } from "react";
import TreeNode from "./TreeNode.jsx";
import { getTree, createTreeNode, updateTreeNode, deleteTreeNode } from "../api.js";

export default function TreeView() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupTitle, setGroupTitle] = useState("");

  const load = () => {
    getTree()
      .then(setTree)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    try {
      await createTreeNode({ title: groupTitle.trim(), parentId: null });
      setGroupTitle("");
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddChild = async (parentId, title, deadline) => {
    try {
      await createTreeNode({ title, parentId, deadline });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggle = async (id, checked) => {
    try {
      const updated = await updateTreeNode(id, { checked });
      setTree(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const updated = await deleteTreeNode(id);
      setTree(updated);
    } catch (e) {
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
          className="rounded-3xl p-6 flex flex-col gap-5"
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
