import { useEffect, useState, useCallback } from "react";
import TaskBlock from "./TaskBlock.jsx";
import { getQueueTasks, createQueueTask, updateQueueTask, deleteQueueTask } from "../api.js";

export default function QueueBoard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("row"); // 'row' | 'grid'

  const load = useCallback(() => {
    getQueueTasks()
      .then((data) => setTasks(data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const tempId = `temp-q-${Date.now()}`;
    const targetDeadline = deadline || null;
    const optimisticTask = {
      id: tempId,
      title: cleanTitle,
      deadline: targetDeadline,
      checked: false,
      order: tasks.length,
      createdAt: new Date().toISOString(),
    };

    // Instant UI update
    setTasks((prev) => [...prev, optimisticTask]);
    setTitle("");
    setDeadline("");

    try {
      const task = await createQueueTask({ title: cleanTitle, deadline: targetDeadline });
      setTasks((prev) => prev.map((t) => (t.id === tempId ? task : t)));
    } catch (e) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setError(e.message);
    }
  };

  const handleToggle = async (id, checked) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, checked } : t)));
    try {
      await updateQueueTask(id, { checked });
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, checked: !checked } : t)));
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    const backup = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteQueueTask(id);
    } catch (e) {
      if (backup) setTasks((prev) => [...prev, backup]);
      setError(e.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
            Queue
          </h2>
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>
            Floating one-day queue. New tasks drift in place until you check them off.
          </p>
        </div>

        {tasks.length > 0 && (
          <div
            className="flex rounded-xl border-2 p-0.5 text-xs font-semibold self-start sm:self-auto"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setViewMode("row")}
              className="px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              style={{
                backgroundColor: viewMode === "row" ? "var(--accent)" : "transparent",
                color: viewMode === "row" ? "#fff" : "var(--text)",
              }}
            >
              Floating Row
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className="px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              style={{
                backgroundColor: viewMode === "grid" ? "var(--accent)" : "transparent",
                color: viewMode === "grid" ? "#fff" : "var(--text)",
              }}
            >
              Card Grid
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task to queue…"
          className="flex-1 min-w-0 rounded-xl px-4 py-2.5 border-2 bg-white/70 outline-none text-base sm:text-sm focus:ring-2"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="rounded-xl px-3 py-2.5 border-2 bg-white/70 outline-none text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 font-semibold text-sm text-white shrink-0 cursor-pointer transition-transform active:scale-95 shadow-sm min-h-[42px]"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Queue it
        </button>
      </form>

      {error && (
        <div
          className="rounded-xl p-3 border text-xs font-medium flex items-center justify-between"
          style={{ backgroundColor: "#ff000012", borderColor: "#ff000030", color: "#c81e33" }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-sm font-bold px-2 py-0.5 cursor-pointer">
            ×
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-soft)" }}>Loading queue…</p>
      ) : tasks.length === 0 ? (
        <div
          className="rounded-3xl border-2 border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
        >
          Nothing queued yet — add today's first task above.
        </div>
      ) : viewMode === "row" ? (
        <div className="flex gap-4 sm:gap-5 overflow-x-auto pb-6 pt-2 -mx-2 px-2 scroll-smooth">
          {tasks.map((task, i) => (
            <TaskBlock
              key={task.id}
              task={task}
              index={i}
              altCard={i % 2 === 1}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 pb-6 pt-2">
          {tasks.map((task, i) => (
            <TaskBlock
              key={task.id}
              task={task}
              index={i}
              altCard={i % 2 === 1}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

