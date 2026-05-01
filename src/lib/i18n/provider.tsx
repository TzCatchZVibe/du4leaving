"use client";

// v19 · 中英双语全站 · TZ "全界面任何地方都可以一键转全中文或者全英文"
// LanguageProvider 包裹整个 app · localStorage 持久 · zh 默认

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DICT, type DictKey, type Lang } from "./dict";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (k: DictKey, fallback?: string) => string;
};

const LanguageContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "hgc-lang-v1";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR 默认 zh · 客户端读 localStorage 覆盖
  const [lang, setLangState] = useState<Lang>("zh");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {
      /* noop */
    }
    setMounted(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* noop */
    }
    // 同步 html lang · 给 SEO/AT 用
    if (typeof document !== "undefined") {
      document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    }
  };

  const toggle = () => setLang(lang === "zh" ? "en" : "zh");

  const t = (k: DictKey, fallback?: string): string => {
    const v = DICT[lang]?.[k];
    if (v) return v;
    return fallback ?? DICT.zh[k] ?? k;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {mounted ? children : children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // fallback · 不在 provider 里也不挂掉
    return {
      lang: "zh",
      setLang: () => {},
      toggle: () => {},
      t: (k: DictKey) => DICT.zh[k] ?? k,
    };
  }
  return ctx;
}
