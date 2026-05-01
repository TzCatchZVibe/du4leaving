// 虾盘 · 浮窗模式 · 全屏看比赛时小窗叠加
//
// 使用方法 ·
//   window.open("/xiapan/overlay", "_blank", "popup,width=400,height=520")
//   把弹出窗口拖到屏幕角落
//   YouTube TV / NBA League Pass 在主屏全屏看
//   关键信息常驻 (余额/盈亏/edge/持仓)

import { OverlayWidget } from "@/components/xiapan/overlay-widget";

export const metadata = {
  title: "🦞 虾盘 浮窗",
};

export default function Page() {
  return <OverlayWidget />;
}
