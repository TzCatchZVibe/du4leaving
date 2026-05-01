// Sprint 1.1 · booking → inquiries 端到端
// Owner: qa (抓虫虾) · Spec: docs/specs/booking-quests.md
//
// 跑前提:
//   1. supabase migration 00009_inquiries_table.sql 已应用到 remote
//   2. .env.local 配好 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
//   3. npx playwright install chromium

import { test, expect } from "@playwright/test";

test.describe("booking page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/booking");
  });

  test("renders form with all required fields", async ({ page }) => {
    await expect(page.getByLabel(/NAME/i)).toBeVisible();
    await expect(page.getByLabel(/EMAIL/i)).toBeVisible();
    await expect(page.getByLabel(/PROJECT/i)).toBeVisible();
    await expect(page.getByLabel(/MESSAGE/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /SEND INQUIRY/i })).toBeVisible();
  });

  test("shows field errors when submitting empty form", async ({ page }) => {
    // 关闭 native validation 强制走我们的 server-side validation
    await page.evaluate(() => {
      document.querySelector("form")?.setAttribute("novalidate", "true");
    });

    await page.getByRole("button", { name: /SEND INQUIRY/i }).click();

    await expect(page.getByText(/请填姓名/)).toBeVisible();
    await expect(page.getByText(/邮箱格式不对/)).toBeVisible();
    await expect(page.getByText(/请选项目类型/)).toBeVisible();
    await expect(page.getByText(/请说一下/)).toBeVisible();
  });

  test("submits valid inquiry and shows success state", async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e-${stamp}@catchzvibe.test`;

    await page.getByLabel(/NAME/i).fill(`E2E Test ${stamp}`);
    await page.getByLabel(/EMAIL/i).fill(email);
    await page.getByLabel(/PROJECT/i).selectOption("agency");
    await page.getByLabel(/WHEN/i).fill("June 2026");
    await page
      .getByLabel(/MESSAGE/i)
      .fill(
        "Playwright e2e 端到端验证 inquiries 表写入 · timestamp " + stamp
      );

    await page.getByRole("button", { name: /SEND INQUIRY/i }).click();

    await expect(page.getByText(/已收到/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/INQUIRY · RECEIVED/)).toBeVisible();
    await expect(page.getByText(/REF ·/)).toBeVisible();
  });

  test("rate limit kicks in after 5 rapid submits", async ({ page, request }) => {
    const body = {
      name: "RateLimitTest",
      email: "rl@test.local",
      project: "other",
      message: "rate limit probe " + Date.now(),
    };
    let last = 200;
    for (let i = 0; i < 7; i++) {
      const r = await request.post("/api/booking", { data: body });
      last = r.status();
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });
});

test.describe("RLS · 越权防御", () => {
  test("anon SELECT inquiries returns empty", async ({ request }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      test.skip();
      return;
    }
    const r = await request.get(`${url}/rest/v1/inquiries?select=*`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    const data = await r.json();
    expect(Array.isArray(data) ? data : []).toEqual([]);
  });
});
