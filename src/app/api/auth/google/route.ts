import type { NextRequest } from "next/server";
import { authSecret, googleConfig, secureCookies } from "@/lib/auth/env";
import { authorizationUrl, OAUTH_COOKIE, OAUTH_COOKIE_PATH, OAUTH_TTL_SECONDS, randomToken, sealFlow } from "@/lib/auth/google";
import { originOf, redirectTo, redirectWithError } from "@/lib/auth/http";
import { safeNext } from "@/lib/auth/next-path";

/**
 * Starts Google sign-in. A plain GET navigation (a link, not a form): Chrome
 * applies CSP form-action to a form's redirect chain, which would block the
 * hop to accounts.google.com.
 */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const config = googleConfig();
  if (!config) return redirectWithError(request, "google_unavailable", next);

  const state = randomToken();
  const verifier = randomToken(48);
  const url = await authorizationUrl(config, originOf(request), state, verifier);
  const res = redirectTo(request, url.toString(), 302);
  res.cookies.set(OAUTH_COOKIE, await sealFlow({ state, verifier, next }, authSecret()), {
    httpOnly: true,
    secure: secureCookies(),
    // Lax: the cookie must come back on Google's top-level redirect to us.
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_TTL_SECONDS,
  });
  return res;
}
