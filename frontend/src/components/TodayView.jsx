import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  getTodayTasks,
  createTodayTask,
  updateTodayTask,
  deleteTodayTask,
} from "../api.js";

const PRIORITIES = [
  { id: "high", label: "High", color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  { id: "medium", label: "Medium", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  { id: "low", label: "Low", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "none", label: "None", color: "var(--text-soft)", bg: "var(--surface)", border: "var(--border)" },
];

function getPriorityConfig(priority) {
  return PRIORITIES.find((p) => p.id === priority) || PRIORITIES[3];
}

function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function TodayView() {
  const [currentDateStr, setCurrentDateStr] = useState(getLocalDateString());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("none");
  const [submitting, setSubmitting] = useState(false);

  // Edit state: { [taskId]: { title, priority } }
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("none");

  // Show/hide completed toggle
  const [showCompleted, setShowCompleted] = useState(true);

  // 1. Auto-detect date changes (e.g. crossing midnight or resuming device)
  useEffect(() => {
    const checkDate = () => {
      const todayStr = getLocalDateString();
      if (todayStr !== currentDateStr) {
        setCurrentDateStr(todayStr);
      }
    };

    const interval = setInterval(checkDate, 20000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkDate();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentDateStr]);

  // 2. Fetch tasks for the current date
  const loadTasks = useCallback(async (dateToLoad) => {
    setLoading(true);
    setError("");
    try {
      const data = await getTodayTasks(dateToLoad);
      setTasks(data || []);
    } catch (err) {
      setError(err.message || "Failed to load today's tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks(currentDateStr);
  }, [currentDateStr, loadTasks]);

  // 3. Optimistic Add Task
  const handleAddTask = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || submitting) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticTask = {
      id: tempId,
      title: cleanTitle,
      priority,
      checked: false,
      date: currentDateStr,
      order: tasks.length,
      createdAt: new Date().toISOString(),
    };

    // Instant UI update
    setTasks((prev) => [...prev, optimisticTask]);
    setTitle("");
    setSubmitting(false);

    try {
      const created = await createTodayTask({
        title: cleanTitle,
        priority,
        date: currentDateStr,
      });
      // Replace temp task with server task
      setTasks((prev) => prev.map((t) => (t.id === tempId ? created : t)));
    } catch (err) {
      // Revert on error
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setError(err.message || "Failed to create task");
    }
  };

  // 4. Optimistic Toggle Task
  const handleToggle = async (id, checked) => {
    // Instant UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, checked } : t))
    );

    try {
      await updateTodayTask(id, { checked });
    } catch (err) {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, checked: !checked } : t))
      );
      setError(err.message || "Failed to update task");
    }
  };

  // 5. Optimistic Delete Task
  const handleDelete = async (id) => {
    const backup = tasks.find((t) => t.id === id);
    // Instant UI update
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      await deleteTodayTask(id);
    } catch (err) {
      // Revert on error
      if (backup) setTasks((prev) => [...prev, backup]);
      setError(err.message || "Failed to delete task");
    }
  };

  // 6. Inline Edit
  const startEdit = (task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority || "none");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleSaveEdit = async (id) => {
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) return;

    const prevTask = tasks.find((t) => t.id === id);
    const updates = { title: cleanTitle, priority: editPriority };

    // Instant UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
    setEditingId(null);

    try {
      await updateTodayTask(id, updates);
    } catch (err) {
      // Revert on error
      if (prevTask) {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? prevTask : t))
        );
      }
      setError(err.message || "Failed to save changes");
    }
  };

  // Split tasks into pending and completed
  const pendingTasks = useMemo(() => {
    const priorityWeight = { high: 1, medium: 2, low: 3, none: 4 };
    return tasks
      .filter((t) => !t.checked)
      .sort((a, b) => {
        const pDiff = (priorityWeight[a.priority] || 4) - (priorityWeight[b.priority] || 4);
        if (pDiff !== 0) return pDiff;
        return (a.order ?? 0) - (b.order ?? 0);
      });
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.checked);
  }, [tasks]);

  const totalCount = tasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Formatted date string (e.g. "Sunday, September 6, 2026")
  const formattedDisplayDate = useMemo(() => {
    try {
      const [y, m, d] = currentDateStr.split("-").map(Number);
      return format(new Date(y, m - 1, d), "EEEE, MMMM d, yyyy");
    } catch {
      return format(new Date(), "EEEE, MMMM d, yyyy");
    }
  }, [currentDateStr]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Date Display */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Today
            </h2>
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: "var(--card2)", color: "var(--accent)" }}
            >
              Daily Focus
            </span>
          </div>
          <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text-soft)" }}>
            {formattedDisplayDate}
          </p>
        </div>

        {/* Progress Tracker Card */}
        {totalCount > 0 && (
          <div
            className="rounded-2xl p-3.5 border-2 flex flex-col gap-2 min-w-[200px] shadow-sm"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "var(--text)" }}>
              <span>Progress</span>
              <span>
                {completedCount} / {totalCount} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-black/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent === 100 ? "#10b981" : "var(--accent)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Task Form */}
      <form
        onSubmit={handleAddTask}
        className="rounded-3xl p-4 sm:p-5 border-2 flex flex-col gap-3.5 shadow-sm"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to accomplish today?…"
            className="flex-1 min-w-0 rounded-xl px-4 py-2.5 border-2 bg-white/80 outline-none text-base sm:text-sm focus:ring-2"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />

          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="rounded-xl px-5 py-2.5 font-semibold text-sm text-white shrink-0 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm min-h-[42px]"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Add Task
          </button>
        </div>

        {/* Priority Selection Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
            Priority:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => {
              const active = priority === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: active ? p.bg : "transparent",
                    borderColor: active ? p.color : "var(--border)",
                    color: active ? p.color : "var(--text-soft)",
                    boxShadow: active ? `0 0 0 1px ${p.color}` : "none",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </form>

      {error && (
        <div
          className="rounded-xl p-3 border text-xs font-medium flex items-center justify-between"
          style={{ backgroundColor: "#ff000012", borderColor: "#ff000030", color: "#c81e33" }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-sm font-bold px-2 py-0.5 hover:opacity-75 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl p-10 text-center border-2 border-dashed flex flex-col items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <p style={{ color: "var(--text-soft)" }}>Loading today's tasks…</p>
        </div>
      ) : tasks.length === 0 ? (
        <div
          className="rounded-3xl border-2 border-dashed p-10 text-center flex flex-col items-center gap-2"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
        >
          <span className="text-3xl">🎯</span>
          <p className="font-display font-semibold text-base" style={{ color: "var(--text)" }}>
            No tasks planned for today yet.
          </p>
          <p className="text-xs max-w-sm">
            Add high-priority tasks above to focus on what matters most today.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* SECTION 1: Pending Tasks */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text)" }}>
                <span>To Do</span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: "var(--card2)", color: "var(--accent)" }}
                >
                  {pendingTasks.length}
                </span>
              </h3>
            </div>

            {pendingTasks.length === 0 ? (
              <div
                className="rounded-2xl p-6 text-center border-2 border-dashed flex items-center justify-center gap-2"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
              >
                <span className="text-xl">🎉</span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  All tasks for today are completed! Great job!
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {pendingTasks.map((task) => {
                  const pConfig = getPriorityConfig(task.priority);
                  const isEditing = editingId === task.id;

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl p-3.5 sm:p-4 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all hover:shadow-md"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      {isEditing ? (
                        <div className="flex-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="flex-1 rounded-xl px-3 py-1.5 border-2 bg-white/90 text-sm outline-none"
                            style={{ borderColor: "var(--border)", color: "var(--text)" }}
                            autoFocus
                          />
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value)}
                            className="rounded-xl px-2.5 py-1.5 border-2 bg-white/90 text-xs font-semibold outline-none"
                            style={{ borderColor: "var(--border)", color: "var(--text)" }}
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(task.id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                              style={{ backgroundColor: "var(--accent)" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer"
                              style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox button */}
                            <button
                              type="button"
                              onClick={() => handleToggle(task.id, true)}
                              className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
                              style={{
                                borderColor: "var(--accent)",
                                backgroundColor: "transparent",
                              }}
                              title="Mark task completed"
                              aria-label="Mark task completed"
                            />

                            {/* Task Title */}
                            <span
                              className="text-sm sm:text-base font-semibold break-words min-w-0"
                              style={{ color: "var(--text)" }}
                            >
                              {task.title}
                            </span>
                          </div>

                          {/* Meta & Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-9 sm:pl-0">
                            {/* Priority Badge */}
                            {task.priority && task.priority !== "none" && (
                              <span
                                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 shrink-0"
                                style={{
                                  backgroundColor: pConfig.bg,
                                  borderColor: pConfig.border,
                                  color: pConfig.color,
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pConfig.color }} />
                                {pConfig.label}
                              </span>
                            )}

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(task)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg border hover:bg-black/[0.04] transition-colors cursor-pointer"
                                style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                                title="Edit task"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(task.id)}
                                className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                                style={{ borderColor: "var(--border)" }}
                                title="Delete task"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center justify-between py-1 text-left cursor-pointer group"
              >
                <h3 className="font-display text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-soft)" }}>
                  <span>{showCompleted ? "▾" : "▸"} Completed</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "var(--card)", color: "var(--text-soft)" }}
                  >
                    {completedTasks.length}
                  </span>
                </h3>
                <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                  {showCompleted ? "Hide" : "Show"}
                </span>
              </button>

              {showCompleted && (
                <div className="flex flex-col gap-2">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl p-3 sm:p-3.5 border-2 flex items-center justify-between gap-3 opacity-70 transition-opacity hover:opacity-100"
                      style={{ backgroundColor: "var(--card2)", borderColor: "var(--border)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggle(task.id, false)}
                          className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer animate-popCheck"
                          style={{
                            borderColor: "var(--accent)",
                            backgroundColor: "var(--accent)",
                          }}
                          title="Mark task pending"
                          aria-label="Mark task pending"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white" fill="none" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>

                        <span
                          className="text-sm font-medium line-through break-words min-w-0"
                          style={{ color: "var(--text-soft)" }}
                        >
                          {task.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer shrink-0"
                        style={{ borderColor: "var(--border)" }}
                        title="Delete task"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
