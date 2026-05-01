# newsnow 自部署 · 解锁双语 alpha

> v0.61 · TZ 双语优势 = 95% 美国押客没看的中文财经
> ourongxing/newsnow · 19.7k stars · TrendRadar 上游 · 直接抓 Wallstreet CN / 财联社

## 1 Mac mini Docker 部署 (推荐)

```bash
# Mac mini SSH 进去
ssh laoxia@mac-mini.local

# 拉镜像 + 跑
docker run -d \
  --name newsnow \
  --restart unless-stopped \
  -p 4444:4444 \
  -e PORT=4444 \
  ghcr.io/ourongxing/newsnow:latest

# 验证
curl http://localhost:4444/api/s\?id=wallstreetcn-quick
# 应返回 JSON {items: [{title, url, pubDate, ...}]}

# 拿 Mac mini 的 LAN IP
ipconfig getifaddr en0
# e.g. 192.168.1.184
```

## 2 catchzvibe env 配置

```bash
# /Users/happyglobal_tk_team/catchzvibe/.env.local
NEWSNOW_BASE_URL=http://192.168.1.184:4444
```

du4 macOS app · /api/xiapan/intel/news 自动加 wallstreet_cn 列表 · summary.wallstreet_cn_enabled=true

## 3 可用源 (newsnow 内置 ID)

| ID | 源 | 用 |
|---|---|---|
| `wallstreetcn-quick` | 华尔街见闻快讯 | 财经实时 · 必加 |
| `wallstreetcn-news` | 华尔街见闻头条 | 深度文章 |
| `cls` | 财联社 | A 股快讯 |
| `cls-telegraph` | 财联社电报 | 实时事件 |
| `xueqiu-hotstock` | 雪球热股 | 股民观点 |
| `weibo` | 微博热搜 | 社会事件 |
| `zhihu` | 知乎热榜 | 长热点 |
| `36kr-quick` | 36 氪快讯 | 创投 |
| `gelonghui` | 格隆汇 | 港美股 |

du4 现在 hardcode 了 `wallstreetcn-quick` · 后续可加多源轮询。

## 4 验证 alpha

```bash
# 拉一遍看
curl 'http://localhost:3001/api/xiapan/intel/news?lang=zh&limit=10'

# 应该看到 Wallstreet CN items 在前面 (近 5min 缓存)
```

## 5 不想 Docker · 直接 Node 跑

```bash
git clone https://github.com/ourongxing/newsnow ~/dev/newsnow
cd ~/dev/newsnow
pnpm install
pnpm dev
# 默认 :3000 · 改 PORT=4444 pnpm dev 防跟 catchzvibe 冲突
```

## 6 路标

- 多源轮询 (weibo + cls + 36kr 一起)
- 关键词过滤 (只要含 "Fed/CPI/election" 的)
- 自动翻译 (用 catchzvibe 现有 OpenAI translate)
