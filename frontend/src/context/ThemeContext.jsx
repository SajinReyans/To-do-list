import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { THEMES, THEME_ORDER } from "../themes.js";
import { getSettings, updateSettings } from "../api.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState("cottonCandy");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setThemeId(s.theme || "cottonCandy"))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const vars = THEMES[themeId]?.vars || THEMES.cottonCandy.vars;
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [themeId]);

  const changeTheme = useCallback((id) => {
    if (!THEME_ORDER.includes(id)) return;
    setThemeId(id);
    updateSettings({ theme: id }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, changeTheme, loaded, themes: THEMES, order: THEME_ORDER }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
