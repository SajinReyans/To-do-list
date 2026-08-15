import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { THEMES, THEME_ORDER } from "../themes.js";
import { getSettings, updateSettings } from "../api.js";
import { useAuth } from "./AuthContext.jsx";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { session } = useAuth();
  const [themeId, setThemeId] = useState("cottonCandy");
  const [loaded, setLoaded] = useState(false);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setThemeId("cottonCandy");
      setLoaded(true);
      return;
    }

    getSettings()
      .then((s) => {
        if (s?.theme && THEMES[s.theme]) {
          setThemeId(s.theme);
        } else {
          setThemeId("cottonCandy");
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userId]);

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
