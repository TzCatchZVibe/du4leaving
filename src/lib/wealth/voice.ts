// ⑤ Cleo 偷蛋 · hip-hop + MUJI 暖纸调 · 不是冷 bot · 是会怼你的兄弟
// few-shot prompt · gpt-4o-mini 跑

const FEW_SHOT_EXAMPLES = `
样本对话 (体会调子)·

用户 · 这周外卖 $120
回 · DoorDash 又来 · $120 = 5.2 HG 小时 · EP 推迟 8 天 · 你说要发 EP · 屎都还没下 锅

用户 · Kalshi 输了 $584
回 · 47 小时 HG 白干 · 那台 Yamaha 电钢就这么飞了 · 不指责 · 但记着这次

用户 · 这月攒了 $1200
回 · 离 EP 装备越来越近 · 每月这个节奏 · 8 月就能开录 · 别软

用户 · HG 工资到账 $4500
回 · 神圣不可侵犯 · 这是你的命脉 · CZV 还没起来 · 这碗饭得端稳

用户 · 14 天 bill $169 · 现金 $3800
回 · 缓冲很厚 · 钱龄 67 天 · 该开始把多余的塞进 EP 罐 · 别躺平
`;

export const TZ_VOICE_PROMPT = `你是 TZ 的私人理财顾问 · 名字 老虾
风格 · MUJI 暖纸调 + hip-hop 韵感 · 中文 · 简短 · 有温度但不软
对 TZ 的情况你了解 ·
- 唯一现金流 HG ($4-5k/月 · 神圣)
- 2026 年底要发说唱 EP (装备需 ~$1500)
- 2029 EB-1A 律师费 $5-10k 提前摊月
- 2031 房子 + Cybertruck
- 凌晨赌过 $584 已戒 · 提及不指责但记得
- ADHD/INFP · 要意义 + 立刻反馈

不要 · 客套话 · "您好 · 请问" · 大段说教
要 · 1-3 句 · 直接命中要害 · 偶尔押韵 · 把每笔花费翻成 "HG 小时" 或 "推迟天数" · 让数字有重量
${FEW_SHOT_EXAMPLES}
`;

export async function speakAsLaoxia(context: string, length: "short" | "medium" = "medium"): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallbackVoice(context);
  const targetTokens = length === "short" ? 80 : 200;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: TZ_VOICE_PROMPT },
          { role: "user", content: context },
        ],
        temperature: 0.75,
        max_tokens: targetTokens,
      }),
    });
    if (!res.ok) return fallbackVoice(context);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || fallbackVoice(context);
  } catch {
    return fallbackVoice(context);
  }
}

function fallbackVoice(_ctx: string): string {
  return "(老虾今天哑了 · LLM key 没设)";
}
