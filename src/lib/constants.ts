// CatchZVibe · 核心常量

export const BRAND_NAME = "CatchZVibe Studio";
export const BRAND_TAGLINE = "AI 时代的摄影师工会";
export const SITE_URL = "https://catchzvibe.studio";

// 7 HG 账号
export const HG_ACCOUNTS = [
  { handle: "@happyglobalschoice", platform: "TK", brand: "HG", purpose: "电商" },
  { handle: "@happyglobalsnacks", platform: "TK", brand: "HG", purpose: "电商" },
  { handle: "@us_happyglobal", platform: "TK", brand: "HG", purpose: "PR" },
  { handle: "@pulseon.us", platform: "TK", brand: "PulseOn", purpose: "电商" },
  { handle: "@pulseon.energy.drink", platform: "TK", brand: "PulseOn", purpose: "PR" },
  { handle: "@happyglobal_inc", platform: "IG", brand: "HG", purpose: "PR" },
  { handle: "@pulseon_energy_drink", platform: "IG", brand: "PulseOn", purpose: "PR" },
] as const;

// 会员等级
export const MEMBERSHIP_TIERS = [
  { key: "bronze", name: "青铜", icon: "🥉", price: "免费", access: "社交内容" },
  { key: "silver", name: "白银", icon: "🥈", price: "$1.99/月", access: "知识库 + 工具" },
  { key: "gold", name: "黄金", icon: "🥇", price: "时间", access: "白银 + 甲方资源 + 冠名号" },
  { key: "hg_employee", name: "HG 员工", icon: "🔵", price: "B2B", access: "素材批发下单" },
] as const;

// 会员福利
export const MEMBER_BENEFITS = [
  { id: 1, title: "文明 6 宏观世界感知", tier: "silver+" },
  { id: 2, title: "后 AI 时代图书馆", tier: "silver+" },
  { id: 3, title: "私域聚集 · 双轨赚钱", tier: "gold" },
  { id: 4, title: "工会名片 · 零预算 marketing", tier: "gold" },
  { id: 5, title: "青铜/白银/黄金 3 层进阶", tier: "all" },
  { id: 6, title: "冠名作品号 + 代运营 + 个人子站", tier: "gold" },
] as const;

// 核心成员（v1 黄金会员）
export const FOUNDING_MEMBERS = [
  { slug: "tz", name: "TZ", role: "系统维护 + 策略 + AI", cities: ["Dallas", "Beijing", "Kunming"] },
  { slug: "fri", name: "Fri", role: "辅拍 + AI 海报 + 导素材", cities: ["Dallas"] },
  { slug: "hank", name: "Hank", role: "剪辑 + 素材库", cities: ["国内"] },
] as const;

// Sprint 8 · Member 子站扩展信息
// 移自 [slug]/page.tsx · server-side metadata 可读 · 后期接 profiles 表替换
export type MemberExtended = {
  specialty: string[];
  bio_en: string;
  bio_cn: string;
  handle: string;
  email: string;
};

export const MEMBER_EXTENDED: Record<string, MemberExtended> = {
  tz: {
    specialty: ["Portraits", "Events", "Street", "Commercial"],
    bio_en:
      "Photographer working across Dallas, Beijing & Kunming. Visual journal aesthetic — cinematic tones, cross-cultural perspective.",
    bio_cn: "三城摄影师 · 视觉日记 · 电影感 · 跨文化视角。",
    handle: "@tz_CatchZVibe.Studio",
    email: "tz@catchzvibe.studio",
  },
  fri: {
    specialty: ["Portraits", "Street", "Lifestyle"],
    bio_en:
      "Dallas-based photographer. Warm natural light, honest moments, documentary feel.",
    bio_cn: "达拉斯摄影师 · 自然光 · 真实瞬间 · 纪录感。",
    handle: "@fri_CatchZVibe.Studio",
    email: "fri@catchzvibe.studio",
  },
  hank: {
    specialty: ["Events", "Commercial", "Video"],
    bio_en:
      "China-based. Video editor & photographer. Sharp eye for narrative pacing.",
    bio_cn: "国内 · 剪辑 + 摄影 · 叙事节奏。",
    handle: "@hank_CatchZVibe.Studio",
    email: "hank@catchzvibe.studio",
  },
};
