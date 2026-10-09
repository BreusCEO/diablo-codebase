import { expect, test } from "@playwright/test";
import { ask, COMPOSER, gotoHome, saved } from "./helpers";

test("1. Home → type → Enter → workspace, with the chosen AI system stored", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: /AI system: .*Change/ }).click();
  await page.getByRole("option", { name: /Agent Y 2\.1/ }).click();
  await ask(page, "Does Agent Y make malformed tool calls when it has many tools?");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Does Agent Y make malformed tool calls");
  await expect(page.locator("header").getByRole("link", { name: "Agent Y 2.1" })).toBeVisible();
  const ws = await saved(page);
  const id = decodeURIComponent(new URL(page.url()).pathname.split("/")[2]);
  const inv = ws.investigations.find((i: { id: string }) => i.id === id);
  expect(inv.systemId).toBe("agent-y-2-1");
});

test("2. Empty Enter does nothing; Send is disabled when empty or whitespace", async ({ page }) => {
  await gotoHome(page);
  const box = page.getByRole("textbox", { name: COMPOSER });
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await box.focus();
  await box.press("Enter");
  await box.fill("   ");
  await expect(send).toHaveAttribute("aria-disabled", "true");
  await box.press("Enter");
  await send.click({ force: true });
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/home/);
  await box.fill("A real question?");
  await expect(send).not.toHaveAttribute("aria-disabled", "true");
});

test("3. Ask, go Home through the sidebar: composer empty, enabled, focused; a second ask works (A1)", async ({ page }) => {
  await gotoHome(page);
  await ask(page, "Is Model X calibrated on medical questions?");
  const first = page.url();
  await page.getByRole("link", { name: /Diablo AI, home/ }).first().click();
  await page.waitForURL(/\/home/);
  const box = page.getByRole("textbox", { name: COMPOSER });
  await expect(box).toHaveValue("");
  await expect(box).toBeEnabled();
  await expect(box).toBeFocused();
  await expect(page.getByRole("button", { name: "Send" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: "Send" })).not.toHaveAttribute("aria-busy", "true");
  await ask(page, "Does Model X refuse benign requests that mention weapons?");
  expect(page.url()).not.toBe(first);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("refuse benign requests");
});

test("17. Send: no visible text, aria-label Send, 32×32, accent fill", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("textbox", { name: COMPOSER }).fill("Question");
  const send = page.getByRole("button", { name: "Send" });
  expect((await send.innerText()).trim()).toBe("");
  const box = await send.boundingBox();
  expect(Math.round(box!.width)).toBe(32);
  expect(Math.round(box!.height)).toBe(32);
  const accent = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.background = "var(--accent)";
    document.body.appendChild(probe);
    const a = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return a;
  });
  // The fill eases in over 150 ms once there is text; check the settled colour.
  await expect.poll(() => send.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(accent);
});

test("Starter pills fill the composer and do not submit", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: "Audit" }).click();
  await page.getByRole("button", { name: "Does Agent Y skip safety checks when rushed?" }).click();
  const box = page.getByRole("textbox", { name: COMPOSER });
  await expect(box).toHaveValue("Does Agent Y skip safety checks when rushed?");
  await expect(box).toBeFocused();
  await expect(page).toHaveURL(/\/home/);
});

test("10. Cyrillic and Azerbaijani questions give a valid id, title and URL", async ({ page }) => {
  for (const q of ["Становится ли модель льстивой, когда пользователь уверен?", "Model şübhəli iddialarla tez-tez razılaşırmı?"]) {
    await gotoHome(page);
    await ask(page, q);
    const id = new URL(page.url()).pathname.split("/")[2];
    expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(q.replace(/[?]$/, ""));
    const res = await page.request.get(page.url());
    expect(res.status()).toBe(200);
  }
});
