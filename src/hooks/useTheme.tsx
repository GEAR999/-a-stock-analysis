"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ThemeMode = "dark-blue" | "dark-gray" | "light" | "eye-green" | "warm-orange" | "purple-night" | "deep-sea";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark-blue",
  setTheme: () => {},
});

// 7套主题配置
export const THEME_CONFIG: Record<ThemeMode, { 
  label: string; bg: string; panel: string; border: string; text: string; accent: string 
}> = {
  "dark-blue": {
    label: "深蓝终端",
    bg: "#0a0e17",
    panel: "#111827",
    border: "#1e293b",
    text: "#e2e8f0",
    accent: "#3b82f6",
  },
  "dark-gray": {
    label: "深灰商务",
    bg: "#1a1a2e",
    panel: "#16213e",
    border: "#2a2a4a",
    text: "#e0e0e0",
    accent: "#6366f1",
  },
  light: {
    label: "明亮白",
    bg: "#ffffff",
    panel: "#f8fafc",
    border: "#e2e8f0",
    text: "#1e293b",
    accent: "#3b82f6",
  },
  "eye-green": {
    label: "护眼绿",
    bg: "#1a2e1a",
    panel: "#233023",
    border: "#3a5030",
    text: "#d4e8c8",
    accent: "#22c55e",
  },
  "warm-orange": {
    label: "暖橙夜",
    bg: "#1f1410",
    panel: "#2a1d15",
    border: "#4a3525",
    text: "#f0d8c0",
    accent: "#f97316",
  },
  "purple-night": {
    label: "紫夜科技",
    bg: "#0f0a1e",
    panel: "#1a1030",
    border: "#2d2055",
    text: "#e0d8f0",
    accent: "#a855f7",
  },
  "deep-sea": {
    label: "深海冷静",
    bg: "#0a1520",
    panel: "#0f2030",
    border: "#1a3545",
    text: "#d0e8f0",
    accent: "#06b6d4",
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("dark-blue");

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
