import { useState, memo } from "react";

function formatDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(deadline, checked) {
  if (!deadline || checked) return false;
  const d = new Date(deadline);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
}

function TaskBlockComponent({ task, index, onToggle, onDelete, altCard }) {
  const [hover, setHover] = useState(false);
  const deadlineLabel = formatDeadline(task.deadline);
  const overdue = isOverdue(task.deadline, task.checked);

  return (
    <div
      className="shrink-0 w-36 h-36 sm:w-44 sm:h-44 animate-floatIn"
      style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`relative w-full h-full rounded-3xl border-2 flex flex-col justify-between p-3.5 sm:p-4 shadow-[0_18px_30px_-14px_rgba(0,0,0,0.25)] ${
          task.checked ? "opacity-60" : "animate-levitate"
        }`}
        style={{
          backgroundColor: altCard ? "var(--card2)" : "var(--card)",
          borderColor: "var(--border)",
          animationPlayState: hover ? "paused" : "running",
        }}
      >
        {!task.checked && (
          <button
            onClick={() => onDelete(task.id)}
            className={`absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-black text-xs font-bold shadow flex items-center justify-center border-2 cursor-pointer transition-all hover:scale-110 active:scale-95 ${
              hover ? "opacity-100" : "opacity-80 sm:opacity-0 group-hover:opacity-100"
            }`}
            style={{ borderColor: "var(--border)" }}
            title="Delete task"
            aria-label="Delete task"
          >
            ×
          </button>
        )}

        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => onToggle(task.id, !task.checked)}
            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-90 ${
              task.checked ? "animate-popCheck" : ""
            }`}
            style={{
              borderColor: "var(--accent)",
              backgroundColor: task.checked ? "var(--accent)" : "transparent",
            }}
            aria-label="Toggle complete"
          >
            {task.checked && (
              <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white" fill="none" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        <p
          className={`font-display font-semibold text-xs sm:text-sm leading-snug break-words ${
            task.checked ? "line-through opacity-60" : ""
          }`}
          style={{ color: "var(--text)" }}
        >
          {task.title}
        </p>

        <div className="flex items-center justify-between">
          {deadlineLabel ? (
            <span
              className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full"
              style={{
                backgroundColor: overdue ? "#f6242422" : "var(--surface)",
                color: overdue ? "#c81e33" : "var(--text)",
                border: "1px solid var(--border)",
              }}
            >
              {overdue ? "Overdue · " : "Due "}
              {deadlineLabel}
            </span>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TaskBlockComponent);

