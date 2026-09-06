import { useEffect, useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { getQueueTasks, getTree } from "../api.js";

function flattenTree(nodes) {
  let out = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out = out.concat(flattenTree(n.children));
  }
  return out;
}

export default function CalendarView() {
  const [month, setMonth] = useState(new Date());
  const [items, setItems] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    Promise.all([
      getQueueTasks().catch(() => []),
      getTree().catch(() => []),
    ])
      .then(([queue, tree]) => {
        const flatQueue = (queue || []).map((t) => ({ ...t, source: "Queue" }));
        const flatTree = flattenTree(tree || []).map((n) => ({ ...n, source: "Tree" }));
        setItems([...flatQueue, ...flatTree].filter((t) => t.deadline));
      })
      .catch(() => {});
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  // Fast O(1) indexed lookup by YYYY-MM-DD
  const itemsByDate = useMemo(() => {
    const map = {};
    for (const it of items) {
      if (!it.deadline) continue;
      const key = it.deadline.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [items]);

  const itemsForDay = (day) => {
    const key = format(day, "yyyy-MM-dd");
    return itemsByDate[key] || [];
  };

  const selectedItems = selectedDay ? itemsForDay(selectedDay) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Calendar
        </h2>
        <p className="text-sm" style={{ color: "var(--text-soft)" }}>
          Every deadline from your queue and tree, in one view.
        </p>
      </div>

      <div
        className="rounded-3xl p-5"
        style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            ‹
          </button>
          <h3 className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>
            {format(month, "MMMM yyyy")}
          </h3>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold mb-2" style={{ color: "var(--text-soft)" }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayItems = itemsForDay(day);
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className="aspect-square rounded-xl p-1.5 flex flex-col items-center gap-1 text-xs"
                style={{
                  backgroundColor: isToday ? "var(--card2)" : "transparent",
                  opacity: inMonth ? 1 : 0.35,
                  border: selectedDay && isSameDay(selectedDay, day) ? "2px solid var(--accent)" : "2px solid transparent",
                  color: "var(--text)",
                }}
              >
                <span className="font-semibold">{format(day, "d")}</span>
                {dayItems.length > 0 && (
                  <span className="flex gap-0.5">
                    {dayItems.slice(0, 3).map((it) => (
                      <span
                        key={it.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: it.checked ? "var(--text-soft)" : "var(--accent)" }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
        >
          <h4 className="font-display font-semibold mb-3" style={{ color: "var(--text)" }}>
            {format(selectedDay, "EEEE, MMMM d")}
          </h4>
          {selectedItems.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              Nothing due this day.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedItems.map((it) => (
                <li key={it.id} className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--card2)", color: "var(--text-soft)" }}
                  >
                    {it.source}
                  </span>
                  <span className={it.checked ? "line-through opacity-60" : ""}>{it.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
