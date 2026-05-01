// v19 · 中英对照字典 · TZ "全界面任何地方都可以一键转全中文或者全英文"
// 命名约定 · 模块.字段 · 一处定义 · 全站复用

export type Lang = "zh" | "en";

export const DICT = {
  zh: {
    // ───── Brand / OS ─────
    "brand.name": "CATCHZVIBE",
    "brand.tagline": "·INT·",
    "brand.internal": "INTERNAL",
    "brand.subtitle": "公会办公楼 · 内部成员之间",

    // ───── Sidebar Modules · v21 房间化 · 公会 MMO 世界观 ─────
    "module.dashboard": "大堂",
    "module.dashboard_en": "Hall",
    "module.intel": "战图厅",
    "module.intel_en": "War Room",
    "module.library": "仓库",
    "module.library_en": "Vault",
    "module.learn": "图书馆",
    "module.learn_en": "Library",
    "module.chat": "议事厅",
    "module.chat_en": "Council",
    "module.recipe": "工坊",
    "module.recipe_en": "Forge",
    "module.publish": "邮政",
    "module.publish_en": "Post",
    "module.monitor": "监控塔",
    "module.monitor_en": "Watch",

    // ───── Common Actions ─────
    "action.signout": "退出",
    "action.read_more": "阅读原文",
    "action.expand": "展开",
    "action.collapse": "折叠",
    "action.toggle_lang": "中 / EN",
    "action.toggle_sidebar": "切换侧栏",

    // ───── Intel HUD ─────
    "hud.local_time": "本地时间",
    "hud.bgm": "BGM",
    "hud.focus": "聚焦",
    "hud.layers": "图层",
    "hud.layers_panel": "图层面板",

    // ───── Layer Names ─────
    "layer.countries": "国家板块",
    "layer.country_labels": "国家名",
    "layer.continent_tint": "大洲底色",
    "layer.cities": "城市点",
    "layer.city_labels": "城市名",
    "layer.events": "事件标记",
    "layer.ocean": "海洋",
    "layer.graticule": "经纬网",
    "layer.climate": "气候带",
    "layer.wind": "风粒子",
    "layer.tilt3d": "3D 倾斜",
    "layer.theme": "主题",

    // ───── Topics ─────
    "topic.politics": "政治",
    "topic.economy": "经济",
    "topic.tech": "科技",
    "topic.philosophy": "哲学",
    "topic.literature": "文学",
    "topic.society": "社会",
    "topic.entertainment": "娱乐",
    "topic.music": "音乐",
    "topic.photography": "摄影",
    "topic.esports": "电竞",
    "topic.console": "主机",

    // ───── Dossier ─────
    "dossier.facts": "事实",
    "dossier.voices": "众声",
    "dossier.individuals": "个人",
    "dossier.collectives": "机构",
    "dossier.empty": "暂无信息",
    "dossier.loading": "加载中…",

    // ───── Region Group ─────
    "region.cn": "中国",
    "region.us": "美国",
    "region.europe": "欧洲",
    "region.other": "其他",

    // ───── Focus Mode ─────
    "focus.title": "聚焦模式",
    "focus.exit": "退出 (Esc)",
    "focus.next": "下一条",
    "focus.prev": "上一条",
  },
  en: {
    "brand.name": "CATCHZVIBE",
    "brand.tagline": "·INT·",
    "brand.internal": "INTERNAL",
    "brand.subtitle": "Guild Headquarters · Members Only",

    // v21 · 房间化 · Guild MMO worldview
    "module.dashboard": "Hall",
    "module.dashboard_en": "大堂",
    "module.intel": "War Room",
    "module.intel_en": "战图厅",
    "module.library": "Vault",
    "module.library_en": "仓库",
    "module.learn": "Library",
    "module.learn_en": "图书馆",
    "module.chat": "Council",
    "module.chat_en": "议事厅",
    "module.recipe": "Forge",
    "module.recipe_en": "工坊",
    "module.publish": "Post",
    "module.publish_en": "邮政",
    "module.monitor": "Watch",
    "module.monitor_en": "监控塔",

    "action.signout": "Sign Out",
    "action.read_more": "Read Original",
    "action.expand": "Expand",
    "action.collapse": "Collapse",
    "action.toggle_lang": "EN / 中",
    "action.toggle_sidebar": "Toggle Sidebar",

    "hud.local_time": "Local Time",
    "hud.bgm": "BGM",
    "hud.focus": "Focus",
    "hud.layers": "Layers",
    "hud.layers_panel": "Layer Panel",

    "layer.countries": "Countries",
    "layer.country_labels": "Country Labels",
    "layer.continent_tint": "Continent Tint",
    "layer.cities": "Cities",
    "layer.city_labels": "City Labels",
    "layer.events": "Events",
    "layer.ocean": "Ocean",
    "layer.graticule": "Graticule",
    "layer.climate": "Climate",
    "layer.wind": "Wind Particles",
    "layer.tilt3d": "3D Tilt",
    "layer.theme": "Theme",

    "topic.politics": "Politics",
    "topic.economy": "Economy",
    "topic.tech": "Tech",
    "topic.philosophy": "Philosophy",
    "topic.literature": "Literature",
    "topic.society": "Society",
    "topic.entertainment": "Entertainment",
    "topic.music": "Music",
    "topic.photography": "Photography",
    "topic.esports": "Esports",
    "topic.console": "Console",

    "dossier.facts": "Facts",
    "dossier.voices": "Voices",
    "dossier.individuals": "Individuals",
    "dossier.collectives": "Collectives",
    "dossier.empty": "No data",
    "dossier.loading": "Loading…",

    "region.cn": "China",
    "region.us": "USA",
    "region.europe": "Europe",
    "region.other": "Other",

    "focus.title": "Focus Mode",
    "focus.exit": "Exit (Esc)",
    "focus.next": "Next",
    "focus.prev": "Prev",
  },
} as const;

export type DictKey = keyof typeof DICT.zh;
