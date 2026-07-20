"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { useTheme, THEME_CONFIG, type ThemeMode } from "@/hooks/useTheme";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: ThemeMode[] = ["dark-blue", "dark-gray", "light", "eye-green", "warm-orange", "purple-night", "deep-sea"];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-white/10 transition-colors"
        title="切换主题"
      >
        <Palette className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded shadow-lg z-50 p-2 min-w-[200px]">
            <div className="grid grid-cols-2 gap-1.5">
              {themes.map((t) => {
                const config = THEME_CONFIG[t];
                const isSelected = theme === t;
                return (
                  <button
                    key={t}
                    onClick={() => { setTheme(t); setIsOpen(false); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                      isSelected 
                        ? "bg-[var(--bg-hover)] ring-1 ring-[var(--accent-blue)]" 
                        : "hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {/* Color preview circles */}
                    <div className="flex -space-x-1 flex-shrink-0">
                      <div 
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: config.bg }}
                      />
                      <div 
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: config.accent }}
                      />
                    </div>
                    <span className={`text-[10px] truncate ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
