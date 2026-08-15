import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import QueueBoard from "./components/QueueBoard.jsx";
import TreeView from "./components/TreeView.jsx";
import CalendarView from "./components/CalendarView.jsx";
import HabitsTracker from "./components/HabitsTracker.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";

const TABS = [
  { id: "queue", label: "Queue" },
  { id: "tree", label: "Tree" },
  { id: "calendar", label: "Calendar" },
  { id: "habits", label: "Habits" },
  { id: "settings", label: "Settings" },
];

function Shell() {
  const [tab, setTab] = useState("queue");
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto px-5 py-8 flex flex-col gap-8">
        <header className="flex items-center justify-between flex-wrap gap-4">
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

          <div className="flex items-center gap-3">
            {user?.email && (
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border-2 truncate max-w-[220px]"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                title={user.email}
              >
                {user.email}
              </span>
            )}
            <button
              onClick={signOut}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border-2 transition-transform hover:-translate-y-0.5 cursor-pointer"
              style={{
                backgroundColor: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <nav
          className="flex gap-1 p-1 rounded-2xl w-fit flex-wrap"
          style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
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
          {tab === "habits" && <HabitsTracker />}
          {tab === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}

function MainContent() {
  const { session, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div
            className="w-12 h-12 rounded-2xl animate-levitate"
            style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)" }}
          />
          <p className="text-sm font-medium" style={{ color: "var(--text-soft)" }}>
            Loading Aloft…
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <Shell key={user?.id || session?.user?.id} />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MainContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
