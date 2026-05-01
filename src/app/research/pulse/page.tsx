// /research/pulse · 本周押注脉搏
//
// V0.54 · 5 月 viral · 自动生成 · 不是一次性博客
// 数据自 picks / whales / cross-arb / mentions · 60s 刷
// 内容是 essay-form · 不是 dashboard
// 目标 · 分享到 HN + r/Polymarket + Twitter · 1 周 1k 引流

import PulseClient from "./pulse-client";

export const metadata = {
  title: "本周押注脉搏 · 哪些场在动 · 哪些大户在押 · DU4LEAVING",
  description: "Kalshi + Polymarket 实时数据 · 7 个本周值得看的信号 · 自动写 · 不停",
  openGraph: {
    title: "本周押注脉搏",
    description: "Kalshi + Polymarket · 7 个本周信号 · 实时",
    type: "article",
    url: "https://catchzvibe.studio/research/pulse",
  },
  twitter: {
    card: "summary_large_image",
    title: "本周押注脉搏 · 7 个值得看的信号",
  },
};

export default function PulsePage() {
  return <PulseClient />;
}
