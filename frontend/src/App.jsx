import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import QueueBoard from "./components/QueueBoard.jsx";
import TreeView from "./components/TreeView.jsx";
import CalendarView from "./components/CalendarView.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";

const TABS = [
  { id: "queue", label: "Queue" },
  { id: "tree", label: "Tree" },
  { id: "calendar", label: "Calendar" },
  { id: "settings", label: "Settings" },
];

function Shell() {
  const [tab, setTab] = useState("queue");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto px-5 py-8 flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl animate-levitate"
              style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)" }}
            />
            <div>
              <h1 className="font-display text-xl font-bold" style={{ color: "var(--text)" }}>
                Aloft
              </h1>
              <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                Tasks that float, goals that branch.
              </p>
            </div>
          </div>
        </header>

        <nav
          className="flex gap-1 p-1 rounded-2xl w-fit"
          style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                backgroundColor: tab === t.id ? "var(--accent)" : "transparent",
                color: tab === t.id ? "#fff" : "var(--text)",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main>
          {tab === "queue" && <QueueBoard />}
          {tab === "tree" && <TreeView />}
          {tab === "calendar" && <CalendarView />}
          {tab === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
