/** Where a signed-in visitor lands when nothing else is asked for. */
export const DEFAULT_AFTER_SIGN_IN = "/home";

/**
 * Open-redirect guard for `?next=`. Only a same-site relative path survives:
 * it must start with a single "/", contain no backslash or control
 * characters, and resolve to this origin. Anything else gives the default.
 */
export function safeNext(value: string | null | undefined, fallback = DEFAULT_AFTER_SIGN_IN): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Browsers treat "\" like "/" ("/\evil.com"), and strip tabs/newlines.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = "http://diablo.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    // Never bounce back into the auth endpoints or the sign-in page itself.
    if (url.pathname === "/" || url.pathname.startsWith("/api/auth")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
