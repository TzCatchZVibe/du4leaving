"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // 仅生产 + https/localhost 注册
    const isLocal =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    if (process.env.NODE_ENV !== "production" && !isLocal) return;
    navigator.serviceWorker
      .register("/du4leaving/sw.js", { scope: "/xiapan" })
      .catch(() => {});
  }, []);
  return null;
}
