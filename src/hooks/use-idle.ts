"use client";

import { useEffect, useState } from "react";

/**
 * 通用 idle hook · 监听用户交互 · 超时无操作返回 isIdle=true
 * - 事件: mousemove / keypress / scroll / touchstart
 * - 每次事件 reset timer
 * - 卸载自动 cleanup
 *
 * @param timeoutMs 空闲阈值 · 默认 30s
 * @returns isIdle · 是否处于空闲
 */
export function useIdle(timeoutMs: number = 30000): boolean {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      if (isIdle) setIsIdle(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsIdle(true), timeoutMs);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];

    for (const ev of events) {
      window.addEventListener(ev, reset, { passive: true });
    }

    // 初始化 · 启动计时
    reset();

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of events) {
        window.removeEventListener(ev, reset);
      }
    };
    // timeoutMs 变化重新绑定 · isIdle 变化不重绑（reset 里处理）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs]);

  return isIdle;
}
