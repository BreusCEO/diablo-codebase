import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, authSecret, secureCookies } from "./env";
import { OAUTH_COOKIE, OAUTH_COOKIE_PATH, type AuthErrorCode } from "./google";
import { SESSION_COOKIE, sessionCookieOptions, signSession, type SessionInput } from "./session";

/** Route-handler helpers: cookies, redirects and the same-origin check. */

export function originOf(request: NextRequest): string {
  return appOrigin(request.nextUrl.origin);
}

/** 303 so a POST becomes a GET on the other side. */
export function redirectTo(request: NextRequest, path: string, status: 302 | 303 = 303): NextResponse {
  const res = NextResponse.redirect(new URL(path, originOf(request)), status);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function redirectWithError(request: NextRequest, code: AuthErrorCode, next?: string): NextResponse {
  const params = new URLSearchParams({ error: code });
  if (next && next !== "/home") params.set("next", next);
  return redirectTo(request, `/?${params}`, 302);
}

export async function setSession(res: NextResponse, input: SessionInput): Promise<NextResponse> {
  res.cookies.set(SESSION_COOKIE, await signSession(input, authSecret()), sessionCookieOptions(secureCookies()));
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(secureCookies()), maxAge: 0 });
  return res;
}

/**
 * CSRF guard for state-changing POSTs: the browser's Origin must be ours.
 * Without Origin, fall back to Fetch Metadata; with neither, refuse.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === request.nextUrl.origin || origin === originOf(request);
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

/** Forgets the single-use OAuth flow cookie. */
export function clearFlow(res: NextResponse): NextResponse {
  res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: OAUTH_COOKIE_PATH, maxAge: 0 });
  return res;
}
