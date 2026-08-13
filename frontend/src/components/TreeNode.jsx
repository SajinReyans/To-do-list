import { useState } from "react";

function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TreeNode({ node, depth, onToggle, onAddChild, onDelete }) {
  const [open, setOpen] = useState(true);
  const [addingChild, setAddingChild] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [childDeadline, setChildDeadline] = useState("");
  const hasChildren = node.children && node.children.length > 0;
  const deadlineLabel = formatDeadline(node.deadline);

  const submitChild = (e) => {
    e.preventDefault();
    if (!childTitle.trim()) return;
    onAddChild(node.id, childTitle.trim(), childDeadline || null);
    setChildTitle("");
    setChildDeadline("");
    setAddingChild(false);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 group">
        {hasChildren && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-5 h-5 flex items-center justify-center text-xs rounded"
            style={{ color: "var(--text-soft)" }}
          >
            {open ? "▾" : "▸"}
          </button>
        )}
        {!hasChildren && <span className="w-5" />}

        <button
          onClick={() => onToggle(node.id, !node.checked)}
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: "var(--accent)",
            backgroundColor: node.checked ? "var(--accent)" : "transparent",
          }}
        >
          {node.checked && (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-white" fill="none" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <span
          className={`font-medium ${depth === 0 ? "font-display text-lg" : "text-sm"} ${
            node.checked ? "line-through opacity-60" : ""
          }`}
          style={{ color: "var(--text)" }}
        >
          {node.title}
        </span>

        {deadlineLabel && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "var(--card2)", color: "var(--text-soft)" }}
          >
            {deadlineLabel}
          </span>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 ml-1 transition-opacity">
          <button
            onClick={() => setAddingChild((v) => !v)}
            className="text-xs px-2 py-0.5 rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
          >
            + child
          </button>
          <button
            onClick={() => onDelete(node.id)}
            className="text-xs px-2 py-0.5 rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
          >
            delete
          </button>
        </div>
      </div>

      {addingChild && (
        <form onSubmit={submitChild} className="ml-9 mt-2 flex flex-wrap gap-2">
          <input
            autoFocus
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            placeholder="New sub-task…"
            className="rounded-lg px-3 py-1.5 border-2 text-sm bg-white/70 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            type="date"
            value={childDeadline}
            onChange={(e) => setChildDeadline(e.target.value)}
            className="rounded-lg px-2 py-1.5 border-2 text-sm bg-white/70 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button
            type="submit"
            className="text-sm px-3 py-1.5 rounded-lg text-white font-semibold"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Add
          </button>
        </form>
      )}

      {hasChildren && open && (
        <div className="ml-2.5 mt-2 pl-6 border-l-2 flex flex-col gap-3" style={{ borderColor: "var(--border)" }}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
