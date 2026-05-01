// DU4LEAVING · /xiapan · public 操作台
// PWA · iPhone "添加到主屏" · macOS Safari "添加到 Dock"

import { PlayDashboard } from "@/components/xiapan/play-dashboard";
import { PwaRegister } from "@/components/xiapan/pwa-register";

export const metadata = {
  title: "DU4LEAVING · KALSHI 価値投注",
  description: "kalshi 价值投注助手 · 找便宜单 · 観戦 · 一击",
  manifest: "/du4leaving/manifest.json",
  themeColor: "#111111",
  appleWebApp: {
    capable: true,
    title: "DU4LEAVING",
    statusBarStyle: "black-translucent" as const,
  },
  icons: {
    icon: [
      { url: "/du4leaving/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/du4leaving/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/du4leaving/apple-touch-icon.png",
    shortcut: "/du4leaving/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function Page() {
  return (
    <>
      <PwaRegister />
      <PlayDashboard />
    </>
  );
}
