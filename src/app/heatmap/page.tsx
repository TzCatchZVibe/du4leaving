// /heatmap · 公开免费 · 无登录引流页
//
// V0.50 · CZ Binance BNB-style 入口策略
// "造一个免费公开站 · 像 BNB 引流 Binance · 7 天必上线"
//
// 内容 · 一屏看清 ·
//   1. 当前最便宜的押注 (来自 picks 引擎)
//   2. 大户实时在押什么 (whales)
//   3. 两个网站 (Kalshi vs Polymarket) 价差 (cross-arb)
//
// CTA · 下载 du4leaving 完整版

import HeatmapClient from "./heatmap-client";

export const metadata = {
  title: "押注热力图 · 哪场便宜 · 大户押什么 · DU4LEAVING",
  description: "Kalshi 跟 Polymarket 押注助手 · 看哪场便宜 · 大户在押什么 · 两边价差 · 高中生都能看懂 · 全免费",
  openGraph: {
    title: "DU4LEAVING · 押注热力图",
    description: "看哪场便宜 · 大户押什么 · 两边价差 · 全免费",
    type: "website",
    url: "https://catchzvibe.studio/heatmap",
  },
  twitter: {
    card: "summary_large_image",
    title: "DU4LEAVING 押注热力图",
    description: "看哪场便宜 · 大户押什么 · 全免费",
  },
};

export default function HeatmapPage() {
  return <HeatmapClient />;
}
