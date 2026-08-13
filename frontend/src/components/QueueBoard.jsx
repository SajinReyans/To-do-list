import { useEffect, useState } from "react";
import TaskBlock from "./TaskBlock.jsx";
import { getQueueTasks, createQueueTask, updateQueueTask, deleteQueueTask } from "../api.js";

export default function QueueBoard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    getQueueTasks()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await createQueueTask({ title, deadline: deadline || null });
      setTasks((prev) => [...prev, task]);
      setTitle("");
      setDeadline("");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleToggle = async (id, checked) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, checked } : t)));
    try {
      await updateQueueTask(id, { checked });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteQueueTask(id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Queue
        </h2>
        <p className="text-sm" style={{ color: "var(--text-soft)" }}>
          One-day tasks. New ones join the queue on the right and drift in place until you check them off.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task to today's queue…"
          className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 border-2 bg-white/70 outline-none focus:ring-2"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="rounded-xl px-3 py-2.5 border-2 bg-white/70 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
        />
        <button
          type="submit"
          className="rounded-xl px-5 py-2.5 font-semibold text-white shrink-0"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Queue it
        </button>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-soft)" }}>Loading…</p>
      ) : tasks.length === 0 ? (
        <div
          className="rounded-3xl border-2 border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
        >
          Nothing queued yet — add today's first task above.
        </div>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-6 pt-2 -mx-2 px-2">
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
