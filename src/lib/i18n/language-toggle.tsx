"use client";

// v19 · 语言切换按钮 · 中 ⇄ EN
// 可放在 sidebar 底部 / 顶部 HUD 任意位置
// 风格 · 极简 · 当前激活高亮 · 手写 OS 字体

import { useLanguage } from "./provider";

export function LanguageToggle({
  variant = "pill",
  className = "",
}: {
  variant?: "pill" | "inline";
  className?: string;
}) {
  const { lang, setLang } = useLanguage();

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => setLang(lang === "zh" ? "en" : "zh")}
        className={`ui-os text-[11px] tracking-widest hover:underline transition ${className}`}
        title={lang === "zh" ? "Switch to English" : "切换到中文"}
        aria-label="Toggle language"
      >
        {lang === "zh" ? "中 / EN" : "EN / 中"}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-0 border-2 border-ink overflow-hidden ${className}`}
      role="group"
      aria-label="Language toggle"
    >
      <button
        type="button"
        onClick={() => setLang("zh")}
        aria-pressed={lang === "zh"}
        className={`ui-os px-2.5 py-1 text-[11px] transition ${
          lang === "zh"
            ? "bg-ink text-paper"
            : "bg-paper-bright text-ink hover:bg-ink/10"
        }`}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`ui-os px-2.5 py-1 text-[11px] tracking-wider transition ${
          lang === "en"
            ? "bg-ink text-paper"
            : "bg-paper-bright text-ink hover:bg-ink/10"
        }`}
      >
        EN
      </button>
    </div>
  );
}
