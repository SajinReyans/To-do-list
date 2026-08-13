import { useTheme } from "../context/ThemeContext.jsx";

export default function SettingsPanel() {
  const { themeId, changeTheme, themes, order } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>
          Settings
        </h2>
        <p className="text-sm" style={{ color: "var(--text-soft)" }}>
          Pick the palette that skins every block, node, and tab across the app.
        </p>
      </div>

      <div
        className="rounded-3xl p-6"
        style={{ backgroundColor: "var(--surface)", border: "2px solid var(--border)" }}
      >
        <h3 className="font-display font-semibold mb-4" style={{ color: "var(--text)" }}>
          Theme
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {order.map((id) => {
            const t = themes[id];
            const active = id === themeId;
            return (
              <button
                key={id}
                onClick={() => changeTheme(id)}
                className="rounded-2xl p-3 border-2 text-left flex flex-col gap-3 transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: active ? t.vars["--accent"] : "var(--border)",
                  backgroundColor: "var(--bg)",
                  boxShadow: active ? `0 0 0 2px ${t.vars["--accent"]}` : "none",
                }}
              >
                <div className="flex h-10 rounded-lg overflow-hidden">
                  {t.swatch.map((c) => (
                    <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
