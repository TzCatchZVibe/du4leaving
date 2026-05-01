// contact-footer.tsx · 公开页面通用页脚
//
// V0.54 · TZ 原则 P3 · 5 分钟客服承诺起点
// 邮件直发 + 反馈链接 · 不依赖 SaaS · 0 钱
"use client";

import { track } from "@vercel/analytics";

const EMAIL = "tomouzheng@gmail.com";

export default function ContactFooter() {
  return (
    <div className="border-t border-black/10 py-6 px-6 text-xs text-[#6A6052] font-mono">
      <div className="max-w-5xl mx-auto flex flex-wrap gap-3 justify-between items-center">
        <div className="flex items-center gap-1">
          <span>du4leaving · CatchZ Studio</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:${EMAIL}?subject=du4leaving 反馈&body=`}
            onClick={() => track("contact_email")}
            className="hover:text-[#111] transition"
          >
            ✉ 给作者发反馈
          </a>
          <span className="text-[#6A6052]/50">·</span>
          <a
            href="/xiapan"
            onClick={() => track("contact_app")}
            className="hover:text-[#111] transition"
          >
            完整版
          </a>
          <span className="text-[#6A6052]/50">·</span>
          <a
            href="/heatmap"
            onClick={() => track("contact_heatmap")}
            className="hover:text-[#111] transition"
          >
            热力图
          </a>
          <span className="text-[#6A6052]/50">·</span>
          <a
            href="/research/pulse"
            onClick={() => track("contact_pulse")}
            className="hover:text-[#111] transition"
          >
            本周脉搏
          </a>
        </div>
      </div>
      <div className="max-w-5xl mx-auto mt-2 text-[10px] text-[#6A6052]/80">
        ✉ 邮件 · 醒着的时候 5 分钟回 · solo 优势 (60 天承诺)
      </div>
    </div>
  );
}
