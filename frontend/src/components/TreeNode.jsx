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

  // Count total completed and total items in subtree
  const countSubtree = (n) => {
    let total = 1;
    let completed = n.checked ? 1 : 0;
    if (n.children && n.children.length > 0) {
      for (const c of n.children) {
        const sub = countSubtree(c);
        total += sub.total;
        completed += sub.completed;
      }
    }
    return { total, completed };
  };

  const { total: totalDescendants, completed: completedDescendants } = hasChildren
    ? countSubtree(node)
    : { total: 1, completed: node.checked ? 1 : 0 };

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
    <div className="relative flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2 group py-1 px-1 rounded-xl transition-colors hover:bg-black/[0.02]">
        {/* Expand / Collapse toggle for nodes with children */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-5 h-5 flex items-center justify-center text-xs rounded transition-transform hover:scale-110 cursor-pointer"
            style={{ color: "var(--text-soft)" }}
            title={open ? "Collapse group" : "Expand group"}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 flex items-center justify-center text-xs opacity-30">•</span>
        )}

        {/* Checkbox button (cascades down all descendants & bubbles up) */}
        <button
          type="button"
          onClick={() => onToggle(node.id, !node.checked)}
          className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
          style={{
            borderColor: "var(--accent)",
            backgroundColor: node.checked ? "var(--accent)" : "transparent",
          }}
          title={node.checked ? "Mark uncompleted" : "Mark completed"}
        >
          {node.checked && (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-white" fill="none" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Node Title */}
        <span
          className={`font-medium break-words ${
            depth === 0
              ? "font-display text-base sm:text-lg font-semibold"
              : depth === 1
              ? "font-display text-sm sm:text-base font-medium"
              : "text-xs sm:text-sm"
          } ${node.checked ? "line-through opacity-60" : ""}`}
          style={{ color: "var(--text)" }}
        >
          {node.title}
        </span>

        {/* Subtree Progress / Child Count Badge when collapsed or on groups */}
        {hasChildren && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: "var(--card2)",
              color: "var(--text-soft)",
            }}
          >
            {node.children.length} {node.children.length === 1 ? "child" : "children"}
            {!open && ` (${completedDescendants}/${totalDescendants})`}
          </span>
        )}

        {/* Optional Deadline Badge */}
        {deadlineLabel && (
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: "var(--card)", color: "var(--text-soft)", border: "1px solid var(--border)" }}
          >
            {deadlineLabel}
          </span>
        )}

        {/* Action buttons (Add child / Delete) */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 ml-auto sm:ml-2 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => setAddingChild((v) => !v)}
            className="text-[11px] font-medium px-2 py-0.5 rounded-lg border transition-colors hover:bg-black/[0.04] cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
            title="Add child group or task"
          >
            + child
          </button>
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="text-[11px] font-medium px-2 py-0.5 rounded-lg border hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
            title="Delete this branch and all descendants"
          >
            delete
          </button>
        </div>
      </div>

      {/* Inline Form to add child group/task at this exact level */}
      {addingChild && (
        <form
          onSubmit={submitChild}
          className="ml-6 sm:ml-8 my-2 p-3 rounded-2xl border-2 flex flex-wrap items-center gap-2"
          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
        >
          <input
            autoFocus
            value={childTitle}
            onChange={(e) => setChildTitle(e.target.value)}
            placeholder={`New child in "${node.title}"…`}
            className="flex-1 min-w-[160px] rounded-lg px-3 py-1.5 border-2 text-sm bg-white/80 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
          <input
            type="date"
            value={childDeadline}
            onChange={(e) => setChildDeadline(e.target.value)}
            className="rounded-lg px-2 py-1.5 border-2 text-xs bg-white/80 outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />
          <button
            type="submit"
            className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold cursor-pointer"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAddingChild(false)}
            className="text-xs px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Recursive Children Rendering at Arbitrary Depth with Indentation Line */}
      {hasChildren && open && (
        <div
          className="ml-3 sm:ml-4 pl-3 sm:pl-4 border-l-2 flex flex-col gap-2 mt-1"
          style={{ borderColor: "var(--border)" }}
        >
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
