import type { NextRequest } from "next/server";
import { authSecret, googleConfig } from "@/lib/auth/env";
import { AuthFlowError, checkCallback, exchangeCode, OAUTH_COOKIE, openFlow } from "@/lib/auth/google";
import { clearFlow, originOf, redirectTo, redirectWithError, setSession } from "@/lib/auth/http";

/** Google sends the visitor back here with ?code&state, or with ?error. */
export async function GET(request: NextRequest) {
  const flow = await openFlow(request.cookies.get(OAUTH_COOKIE)?.value, authSecret());
  const config = googleConfig();
  // The flow cookie is single-use, whatever the outcome.
  if (!config) return clearFlow(redirectWithError(request, "google_unavailable"));

  try {
    const code = checkCallback(request.nextUrl.searchParams, flow);
    const identity = await exchangeCode(config, originOf(request), code, flow!.verifier);
    return clearFlow(await setSession(redirectTo(request, flow!.next, 302), identity));
  } catch (err) {
    const code = err instanceof AuthFlowError ? err.code : "server_error";
    if (code === "exchange_failed" || code === "server_error") {
      console.error("[auth] Google callback failed:", err instanceof Error ? err.message : "unknown error");
    }
    return clearFlow(redirectWithError(request, code, flow?.next));
  }
}
