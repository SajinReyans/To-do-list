import { useEffect, useState, useMemo, useCallback } from "react";
import {
  format,
  eachDayOfInterval,
  startOfYear,
  endOfYear,
  getDay,
  isToday,
  subDays,
} from "date-fns";
import {
  getHabits,
  createHabit,
  deleteHabit,
  getAllHabitCompletions,
  toggleHabitCompletion,
} from "../api.js";

const PRESET_ICONS = ["📖", "🏃", "💧", "🧘", "🥗", "💻", "🎨", "✍️", "🎸", "💤", "⚡", "🎯"];
const PRESET_COLORS = [
  "#f43f5e", // Rose
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#eab308", // Yellow
  "#f97316", // Orange
];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function calculateStreaks(datesMap, year, allDays) {
  const currentYear = new Date().getFullYear();
  const isCurrentYear = year === currentYear;
  const today = new Date();
  const yearStart = allDays && allDays.length > 0 ? allDays[0] : startOfYear(new Date(year, 0, 1));
  const daysList = allDays || eachDayOfInterval({ start: yearStart, end: endOfYear(new Date(year, 0, 1)) });

  let longest = 0;
  let currentRun = 0;
  let total = 0;

  for (const day of daysList) {
    const key = format(day, "yyyy-MM-dd");
    if (datesMap[key]) {
      total += 1;
      currentRun += 1;
      if (currentRun > longest) longest = currentRun;
    } else {
      currentRun = 0;
    }
  }


  // Calculate current active streak
  let currentStreak = 0;
  if (isCurrentYear) {
    let checkDate = today;
    const todayKey = format(checkDate, "yyyy-MM-dd");
    // If today is checked, start from today. If not checked yet, start check from yesterday.
    if (!datesMap[todayKey]) {
      checkDate = subDays(today, 1);
    }
    while (checkDate >= yearStart) {
      const k = format(checkDate, "yyyy-MM-dd");
      if (datesMap[k]) {
        currentStreak += 1;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  }

  const daysInYear = allDays.length;
  const percentage = daysInYear > 0 ? Math.round((total / daysInYear) * 100) : 0;

  return { total, longest, currentStreak, percentage, daysInYear };
}

export default function HabitsTracker() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState({}); // { [habitId]: { [dateStr]: boolean } }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("📖");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'months'
  const [expandedMonths, setExpandedMonths] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fetchedHabits, fetchedCompletions] = await Promise.all([
        getHabits(year),
        getAllHabitCompletions(year),
      ]);
      setHabits(fetchedHabits || []);
      setCompletions(fetchedCompletions || {});
    } catch (err) {
      setError(err.message || "Failed to load habits");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateHabit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await createHabit({
        title: newTitle.trim(),
        icon: newIcon,
        color: newColor,
        year,
      });
      setHabits((prev) => [...prev, created]);
      setNewTitle("");
    } catch (err) {
      setError(err.message || "Failed to create habit");
    }
  };

  const handleDeleteHabit = async (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    try {
      await deleteHabit(id);
    } catch (err) {
      setError(err.message || "Failed to delete habit");
    }
  };

  const handleToggleDay = async (habitId, dateStr) => {
    const currentVal = completions[habitId]?.[dateStr] || false;
    const newVal = !currentVal;

    // Optimistic UI update
    setCompletions((prev) => ({
      ...prev,
      [habitId]: {
        ...(prev[habitId] || {}),
        [dateStr]: newVal,
      },
    }));

    try {
      await toggleHabitCompletion(habitId, dateStr, newVal);
    } catch (err) {
      // Revert on failure
      setCompletions((prev) => ({
        ...prev,
        [habitId]: {
          ...(prev[habitId] || {}),
          [dateStr]: currentVal,
        },
      }));
      setError(err.message || "Failed to update date");
    }
  };

  // Generate 53-week matrix of days for the selected year
  const yearDays = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return eachDayOfInterval({ start, end });
  }, [year]);

  // Group days into columns of weeks (Sun-Sat)
  const weekColumns = useMemo(() => {
    const cols = [];
    let currentWeek = [];

    // Pad first week if year doesn't start on Sunday
    const firstDayOfWeek = getDay(yearDays[0]);
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (const day of yearDays) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      cols.push(currentWeek);
    }

    return cols;
  }, [yearDays]);

  // Month header markers for GitHub grid
  const monthMarkers = useMemo(() => {
    const markers = [];
    let lastMonth = -1;
    weekColumns.forEach((week, weekIndex) => {
      const validDay = week.find((d) => d !== null);
      if (validDay) {
        const m = validDay.getMonth();
        if (m !== lastMonth) {
          markers.push({ monthIndex: m, label: MONTH_NAMES[m], weekIndex });
          lastMonth = m;
        }
      }
    });
    return markers;
  }, [weekColumns]);

  // Days grouped by month for month-by-month accordion view
  const daysByMonth = useMemo(() => {
    const groups = Array.from({ length: 12 }, () => []);
    for (const d of yearDays) {
      groups[d.getMonth()].push(d);
    }
    return groups;
  }, [yearDays]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
            Habits Tracker
          </h2>
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>
            365 days of building momentum. Check off daily habits and watch your streaks grow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-2xl border-2 px-2 py-1"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-sm font-semibold hover:bg-black/[0.05] transition-colors cursor-pointer"
              style={{ color: "var(--text)" }}
              title="Previous Year"
            >
              ‹
            </button>
            <span className="px-3 font-display text-base font-bold" style={{ color: "var(--text)" }}>
              {year}
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-sm font-semibold hover:bg-black/[0.05] transition-colors cursor-pointer"
              style={{ color: "var(--text)" }}
              title="Next Year"
            >
              ›
            </button>
          </div>

          <div
            className="flex rounded-2xl border-2 p-1 text-xs font-semibold"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className="px-3 py-1 rounded-xl transition-colors cursor-pointer"
              style={{
                backgroundColor: viewMode === "grid" ? "var(--accent)" : "transparent",
                color: viewMode === "grid" ? "#fff" : "var(--text)",
              }}
            >
              365 Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("months")}
              className="px-3 py-1 rounded-xl transition-colors cursor-pointer"
              style={{
                backgroundColor: viewMode === "months" ? "var(--accent)" : "transparent",
                color: viewMode === "months" ? "#fff" : "var(--text)",
              }}
            >
              Months
            </button>
          </div>
        </div>
      </div>

      {year !== currentYear && (
        <div
          className="rounded-2xl p-3.5 border-2 text-xs font-medium flex items-center justify-between"
          style={{ backgroundColor: "var(--card2)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <span>
            🗓️ Viewing historical habit records for <strong>{year}</strong>. Active habits automatically roll over to <strong>{currentYear}</strong>.
          </span>
          <button
            type="button"
            onClick={() => setYear(currentYear)}
            className="px-3 py-1 rounded-xl text-xs font-semibold text-white cursor-pointer ml-3 shrink-0"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Jump to {currentYear}
          </button>
        </div>
      )}

      {/* Add New Habit Form */}
      <form
        onSubmit={handleCreateHabit}
        className="rounded-3xl p-5 border-2 flex flex-col gap-4 shadow-sm"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text)" }}>
          New Habit for {year}
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Habit title (e.g. Read 20 pages, Morning Jog, Meditate)…"
            className="flex-1 min-w-[220px] rounded-xl px-4 py-2.5 border-2 bg-white/80 outline-none text-sm focus:ring-2"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          />

          {/* Emoji selector */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {PRESET_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setNewIcon(emoji)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm border transition-transform hover:scale-110 cursor-pointer"
                style={{
                  borderColor: newIcon === emoji ? "var(--accent)" : "var(--border)",
                  backgroundColor: newIcon === emoji ? "var(--card)" : "transparent",
                  boxShadow: newIcon === emoji ? "0 0 0 2px var(--accent)" : "none",
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Color selector */}
          <div className="flex items-center gap-1.5 py-1">
            {PRESET_COLORS.map((clr) => (
              <button
                key={clr}
                type="button"
                onClick={() => setNewColor(clr)}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer"
                style={{
                  backgroundColor: clr,
                  borderColor: newColor === clr ? "var(--text)" : "transparent",
                  boxShadow: newColor === clr ? "0 0 0 2px #fff" : "none",
                }}
              />
            ))}
          </div>

          <button
            type="submit"
            className="rounded-xl px-5 py-2.5 font-semibold text-sm text-white shrink-0 cursor-pointer transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Add Habit
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Habit Cards List */}
      {loading ? (
        <p style={{ color: "var(--text-soft)" }}>Loading habits for {year}…</p>
      ) : habits.length === 0 ? (
        <div
          className="rounded-3xl border-2 border-dashed p-10 text-center flex flex-col items-center gap-2"
          style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
        >
          <span className="text-3xl">🌱</span>
          <p className="font-display font-medium">No habits registered for {year} yet.</p>
          <p className="text-xs max-w-md">
            Create your first habit above to track your daily progress across 365 days.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {habits.map((habit) => {
            const habitCompletions = completions[habit.id] || {};
            const stats = calculateStreaks(habitCompletions, year, yearDays);
            const isDoneToday = Boolean(habitCompletions[todayStr]);
            const habitColor = habit.color || "var(--accent)";

            return (
              <div
                key={habit.id}
                className="rounded-3xl p-5 sm:p-6 border-2 flex flex-col gap-4 shadow-md transition-shadow hover:shadow-lg"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                {/* Habit Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm"
                      style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)" }}
                    >
                      {habit.icon || "🎯"}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold" style={{ color: "var(--text)" }}>
                        {habit.title}
                      </h3>
                      <p className="text-xs flex items-center gap-2" style={{ color: "var(--text-soft)" }}>
                        <span>🔥 Streak: <strong>{stats.currentStreak} days</strong></span>
                        <span>•</span>
                        <span>⭐ Best: <strong>{stats.longest} days</strong></span>
                        <span>•</span>
                        <span>{stats.total}/{stats.daysInYear} days ({stats.percentage}%)</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick check for today */}
                    {year === currentYear && (
                      <button
                        type="button"
                        onClick={() => handleToggleDay(habit.id, todayStr)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold border-2 flex items-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-pointer shadow-sm"
                        style={{
                          backgroundColor: isDoneToday ? habitColor : "var(--bg)",
                          borderColor: isDoneToday ? habitColor : "var(--border)",
                          color: isDoneToday ? "#ffffff" : "var(--text)",
                        }}
                      >
                        <span style={{ color: isDoneToday ? "#ffffff" : "var(--text)" }}>
                          {isDoneToday ? "✓ Done Today" : "○ Check Today"}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="w-8 h-8 rounded-xl border flex items-center justify-center text-xs text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      title="Delete habit"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* VIEW 1: 365-Day GitHub Contribution Heatmap Grid */}
                {viewMode === "grid" && (
                  <div className="overflow-x-auto pb-2 -mx-2 px-2">
                    <div className="inline-block min-w-full">
                      {/* Month labels */}
                      <div className="flex text-[10px] font-semibold mb-1 ml-6 relative h-4" style={{ color: "var(--text-soft)" }}>
                        {monthMarkers.map((m) => (
                          <span
                            key={m.monthIndex}
                            style={{
                              position: "absolute",
                              left: `${m.weekIndex * 14}px`,
                            }}
                          >
                            {m.label}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-1 items-start">
                        {/* Day of week labels (Su, Mo, Tu...) */}
                        <div className="flex flex-col gap-1 text-[9px] font-semibold pr-1 shrink-0 pt-0.5" style={{ color: "var(--text-soft)" }}>
                          {["S", "M", "T", "W", "T", "F", "S"].map((dayName, idx) => (
                            <span key={idx} className="h-3 flex items-center justify-center w-4">
                              {idx % 2 === 1 ? dayName : ""}
                            </span>
                          ))}
                        </div>

                        {/* Weeks grid */}
                        <div className="flex gap-1">
                          {weekColumns.map((week, wIdx) => (
                            <div key={wIdx} className="flex flex-col gap-1">
                              {week.map((day, dIdx) => {
                                if (!day) {
                                  return <div key={`empty-${dIdx}`} className="w-3 h-3 rounded-sm opacity-0" />;
                                }

                                const dateKey = format(day, "yyyy-MM-dd");
                                const isDone = Boolean(habitCompletions[dateKey]);
                                const isCurrentDay = isToday(day);

                                return (
                                  <button
                                    key={dateKey}
                                    type="button"
                                    onClick={() => handleToggleDay(habit.id, dateKey)}
                                    className="w-3 h-3 rounded-sm border transition-transform hover:scale-125 cursor-pointer relative group/cell"
                                    style={{
                                      backgroundColor: isDone ? habitColor : "var(--bg)",
                                      borderColor: isCurrentDay ? "var(--text)" : isDone ? habitColor : "var(--border)",
                                      boxShadow: isCurrentDay ? "0 0 0 1px var(--text)" : "none",
                                    }}
                                    title={`${format(day, "EEE, MMM d, yyyy")}: ${isDone ? "Completed" : "Not completed"}`}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 2: Collapsible Month-by-Month Cards */}
                {viewMode === "months" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {daysByMonth.map((monthDays, mIdx) => {
                      const monthCompleted = monthDays.filter(
                        (d) => habitCompletions[format(d, "yyyy-MM-dd")]
                      ).length;
                      const isOpen = expandedMonths[`${habit.id}-${mIdx}`] ?? true;

                      return (
                        <div
                          key={mIdx}
                          className="rounded-2xl p-3 border-2 flex flex-col gap-2"
                          style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMonths((prev) => ({
                                ...prev,
                                [`${habit.id}-${mIdx}`]: !isOpen,
                              }))
                            }
                            className="flex items-center justify-between w-full text-xs font-semibold cursor-pointer"
                            style={{ color: "var(--text)" }}
                          >
                            <span>{MONTH_NAMES[mIdx]}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-soft)" }}>
                              {monthCompleted}/{monthDays.length} {isOpen ? "▾" : "▸"}
                            </span>
                          </button>

                          {isOpen && (
                            <div className="grid grid-cols-7 gap-1 pt-1">
                              {monthDays.map((d) => {
                                const k = format(d, "yyyy-MM-dd");
                                const done = Boolean(habitCompletions[k]);
                                const isCurrent = isToday(d);

                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => handleToggleDay(habit.id, k)}
                                    className="aspect-square rounded-lg text-[10px] font-semibold border flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                                    style={{
                                      backgroundColor: done ? habitColor : "var(--bg)",
                                      color: done ? "#fff" : "var(--text)",
                                      borderColor: isCurrent ? "var(--accent)" : "var(--border)",
                                      borderWidth: isCurrent ? "2px" : "1px",
                                    }}
                                    title={format(d, "EEE, MMM d")}
                                  >
                                    {format(d, "d")}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
