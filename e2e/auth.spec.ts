import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COMPOSER } from "./helpers";

const signedOut = { cookies: [], origins: [] };

async function enterDemo(page: Page) {
  await page.getByRole("button", { name: "Enter demo workspace" }).click();
}

test.describe("signed out", () => {
  test.use({ storageState: signedOut });

  test("Unauthenticated /home redirects to sign-in, remembering where it was going", async ({ page }) => {
    const res = await page.goto("/home");
    expect(new URL(page.url()).pathname).toBe("/");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/home");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("button", { name: "Enter demo workspace" })).toBeVisible();
    // Every dashboard is behind the same door.
    for (const path of ["/investigations", "/systems", "/experiments", "/evidence", "/reports", "/datasets", "/settings", "/design"]) {
      await page.goto(path);
      expect(new URL(page.url()).pathname, path).toBe("/");
    }
  });

  test("Demo sign-in reaches /home with the demo identity", async ({ page }) => {
    await page.goto("/");
    await enterDemo(page);
    await page.waitForURL("**/home");
    await expect(page.getByRole("textbox", { name: COMPOSER })).toBeVisible();
    await expect(page.getByRole("button", { name: "Account: Demo researcher, Demo" }).first()).toBeVisible();
    const cookie = (await page.context().cookies()).find((c) => c.name === "diablo_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    // The test server runs the production build, where the cookie is Secure.
    expect(cookie?.secure).toBe(true);
    expect(cookie?.path).toBe("/");
  });

  test("A deep link survives sign-in; a foreign ?next= does not", async ({ page, baseURL }) => {
    await page.goto("/investigations/tool-use-reliability?tab=report");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/investigations/tool-use-reliability?tab=report");
    await enterDemo(page);
    await page.waitForURL("**/investigations/tool-use-reliability?tab=report");

    // Protocol-relative, and dot segments that collapse into one.
    for (const evil of ["//evil.example/steal", "/.//evil.example/steal", "/a/..//evil.example/steal"]) {
      await page.context().clearCookies();
      await page.goto(`/?next=${encodeURIComponent(evil)}`);
      await enterDemo(page);
      await page.waitForURL("**/home");
      expect(new URL(page.url()).origin, evil).toBe(new URL(baseURL!).origin);
      expect(new URL(page.url()).pathname, evil).toBe("/home");
    }
  });

  test("Demo sign-in works without JavaScript, and keeps a sanitised ?next=", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: signedOut, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator('form[action="/api/auth/demo"] input[name="next"]')).toHaveValue("");
    await enterDemo(page);
    await page.waitForURL("**/home");

    // The hidden field is in the server's HTML, so the deep link survives without any script.
    await ctx.clearCookies();
    await page.goto(`/?next=${encodeURIComponent("/investigations/tool-use-reliability?tab=report")}`);
    await expect(page.locator('form[action="/api/auth/demo"] input[name="next"]')).toHaveValue("/investigations/tool-use-reliability?tab=report");
    await enterDemo(page);
    await page.waitForURL("**/investigations/tool-use-reliability?tab=report");

    // Still relative paths only.
    for (const evil of ["https://evil.example", "//evil.example", "/.//evil.example", "/api/auth/signout"]) {
      await ctx.clearCookies();
      await page.goto(`/?next=${encodeURIComponent(evil)}`);
      await expect(page.locator('form[action="/api/auth/demo"] input[name="next"]'), evil).toHaveValue("");
      await enterDemo(page);
      await page.waitForURL("**/home");
      expect(new URL(page.url()).origin, evil).toBe(new URL(baseURL!).origin);
    }

    // Errors are explained without JavaScript too.
    await ctx.clearCookies();
    await page.goto("/?error=state_mismatch");
    await expect(page.locator("main [role=alert]")).toContainText("expired");
    await ctx.close();
  });

  test("Google is offered but disabled with a reason when it is not configured; the start route explains", async ({ page }) => {
    await page.goto("/");
    const google = page.getByRole("button", { name: "Continue with Google" });
    await expect(google).toBeDisabled();
    await expect(page.getByText("Google sign-in is not configured on this server.")).toBeVisible();
    await page.goto("/api/auth/google?next=/settings");
    expect(new URL(page.url()).searchParams.get("error")).toBe("google_unavailable");
    await expect(page.locator("main [role=alert]")).toContainText("Google sign-in isn't set up");
  });

  test("A failed callback shows an inline error on the sign-in page", async ({ page }) => {
    await page.goto("/api/auth/google/callback?error=access_denied&state=x");
    expect(new URL(page.url()).pathname).toBe("/");
    // Without Google configured the callback refuses outright; with it, Google's own error is named.
    await expect(page.locator("main [role=alert]")).toBeVisible();
    await page.goto("/?error=state_mismatch");
    await expect(page.locator("main [role=alert]")).toContainText("expired");
  });

  test("Forged cookies and cross-site POSTs are refused", async ({ page, request, baseURL }) => {
    const host = new URL(baseURL!).hostname;
    await page.context().addCookies([{ name: "diablo_session", value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwicHJvdmlkZXIiOiJkZW1vIn0.forged", domain: host, path: "/" }]);
    await page.goto("/home");
    expect(new URL(page.url()).pathname).toBe("/");

    // The forged cookie is deleted on the way, and on the sign-in page too.
    expect((await page.context().cookies()).some((c) => c.name === "diablo_session")).toBe(false);
    await page.context().addCookies([{ name: "diablo_session", value: "garbage", domain: host, path: "/" }]);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Enter demo workspace" })).toBeVisible();
    expect((await page.context().cookies()).some((c) => c.name === "diablo_session")).toBe(false);

    const demo = await request.post("/api/auth/demo", { headers: { Origin: "https://evil.example" }, maxRedirects: 0 });
    expect(demo.status()).toBe(403);
    // A sibling site, a sandboxed frame (Origin: null), and no Origin at all are refused too.
    const refused: Record<string, string>[] = [{ Origin: "https://evil.localhost" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }, {}];
    for (const headers of refused) {
      const res = await request.post("/api/auth/demo", { headers, maxRedirects: 0 });
      expect(res.status(), JSON.stringify(headers)).toBe(403);
      expect(res.headers()["set-cookie"] ?? "", JSON.stringify(headers)).not.toContain("diablo_session");
    }
    const same = await request.post("/api/auth/demo", { headers: { Origin: new URL(baseURL!).origin }, maxRedirects: 0 });
    expect(same.status()).toBe(303);
    const out = await request.post("/api/auth/signout", { headers: { Origin: "https://evil.example" }, maxRedirects: 0 });
    expect(out.status()).toBe(403);
    expect((await request.get("/api/auth/signout", { maxRedirects: 0 })).status()).toBe(405);
  });

  for (const theme of ["light", "dark"] as const) {
    for (const width of [375, 1440]) {
      test(`Sign-in page passes axe, ${theme}, ${width}px, with an error showing too`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: signedOut, viewport: { width, height: 900 }, colorScheme: theme });
        const page = await ctx.newPage();
        const problems: string[] = [];
        for (const route of ["/", "/?error=access_denied"]) {
          await page.goto(route);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(2800); // let the entrance finish
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
          if (overflow) problems.push(`${route}: horizontal scroll`);
          const result = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          for (const v of result.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
            problems.push(`${route}: ${v.id} (${v.impact}) × ${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`);
          }
        }
        expect(problems, problems.join("\n")).toEqual([]);
        await ctx.close();
      });
    }
  }
});

test.describe("signed in", () => {
  test("A signed-in visitor to / goes straight to /home, or on to a safe ?next=", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/home");
    await page.goto(`/?next=${encodeURIComponent("/settings")}`);
    await page.waitForURL("**/settings");
    await page.goto(`/?next=${encodeURIComponent("/.//evil.example")}`);
    await page.waitForURL("**/home");
  });

  test("Sign out returns to / and closes the workspace", async ({ browser }) => {
    // Its own session, so signing out cannot affect the shared one.
    const ctx = await browser.newContext({ storageState: signedOut });
    const page = await ctx.newPage();
    await page.goto("/");
    await enterDemo(page);
    await page.waitForURL("**/home");
    await page.getByRole("button", { name: /^Account:/ }).first().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("button", { name: "Enter demo workspace" })).toBeVisible();
    expect((await ctx.cookies()).some((c) => c.name === "diablo_session")).toBe(false);
    await page.goto("/home");
    expect(new URL(page.url()).pathname).toBe("/");
    await ctx.close();
  });
});
