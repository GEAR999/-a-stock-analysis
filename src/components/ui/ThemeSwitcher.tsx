"use client";

import { useState } from "react";
import { Sun, Moon, Eye } from "lucide-react";
import { useTheme, THEME_CONFIG, type ThemeMode } from "@/hooks/useTheme";

const themeIcons: Record<ThemeMode, typeof Sun> = {
  dark: Moon,
  light: Sun,
  "eye-care": Eye,
};

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const Icon = themeIcons[theme];

  const themes: ThemeMode[] = ["dark", "light", "eye-care"];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-white/10 transition-colors"
        title="切换主题"
      >
        <Icon className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-[#1a1f2e] border border-gray-700 rounded shadow-lg z-50 min-w-[100px]">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => { setTheme(t); setIsOpen(false); }}
                className={`w-full px-3 py-1.5 text-left text-[10px] hover:bg-white/5 flex items-center gap-2 ${
                  theme === t ? "text-blue-400" : "text-gray-400"
                }`}
              >
                {(() => { const I = themeIcons[t]; return <I className="w-3 h-3" />; })()}
                {THEME_CONFIG[t].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
