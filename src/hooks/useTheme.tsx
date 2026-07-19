"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "eye-care";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
});

// 主题配置
export const THEME_CONFIG: Record<ThemeMode, { label: string; bg: string; panel: string; border: string; text: string; textSecondary: string }> = {
  dark: {
    label: "深色",
    bg: "#0a0e17",
    panel: "#111827",
    border: "#1e293b",
    text: "#e2e8f0",
    textSecondary: "#94a3b8",
  },
  light: {
    label: "浅色",
    bg: "#f8fafc",
    panel: "#ffffff",
    border: "#e2e8f0",
    text: "#1e293b",
    textSecondary: "#64748b",
  },
  "eye-care": {
    label: "护眼",
    bg: "#1a1f16",
    panel: "#232b1e",
    border: "#3a4530",
    text: "#d4d8c8",
    textSecondary: "#8b9478",
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    // 从 localStorage 读取主题设置
    const saved = localStorage.getItem("app-theme") as ThemeMode | null;
    if (saved && THEME_CONFIG[saved]) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    // 保存主题设置
    localStorage.setItem("app-theme", theme);
    // 应用主题到 document
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
