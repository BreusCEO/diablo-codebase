import "server-only";
import { decodeJwt, jwtVerify, SignJWT } from "jose";
import type { GoogleConfig } from "./env";
import type { SessionInput } from "./session";

/**
 * Google sign-in: OAuth 2.0 Authorization Code flow with PKCE (S256) and a
 * `state` nonce, done with plain fetch. The verifier, state and `next` travel
 * in a short-lived signed cookie scoped to the callback path.
 */
export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const OAUTH_COOKIE = "diablo_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";
export const OAUTH_TTL_SECONDS = 10 * 60;
export const CALLBACK_PATH = "/api/auth/google/callback";

/** Errors the login page knows how to explain (`/?error=<code>`). */
export type AuthErrorCode = "google_unavailable" | "access_denied" | "state_mismatch" | "exchange_failed" | "unverified_email" | "server_error";

export class AuthFlowError extends Error {
  constructor(public readonly code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthFlowError";
  }
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export function redirectUri(origin: string): string {
  return new URL(CALLBACK_PATH, origin).toString();
}

export async function authorizationUrl(config: GoogleConfig, origin: string, state: string, verifier: string): Promise<URL> {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", await pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

// ── The flow cookie ──────────────────────────────────────────────

export interface FlowState {
  state: string;
  verifier: string;
  next: string;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function sealFlow(flow: FlowState, secret: string): Promise<string> {
  return new SignJWT({ st: flow.state, cv: flow.verifier, nx: flow.next })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("diablo-oauth")
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_TTL_SECONDS}s`)
    .sign(key(secret));
}

export async function openFlow(token: string | undefined, secret: string): Promise<FlowState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"], audience: "diablo-oauth" });
    const { st, cv, nx } = payload;
    if (typeof st !== "string" || typeof cv !== "string" || typeof nx !== "string") return null;
    return { state: st, verifier: cv, next: nx };
  } catch {
    return null;
  }
}

/** Constant-time string comparison for the state nonce. */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checks the callback's query against the flow cookie. Returns the code to
 * exchange, or throws an AuthFlowError naming what went wrong.
 */
export function checkCallback(params: URLSearchParams, flow: FlowState | null): string {
  const error = params.get("error");
  if (error) throw new AuthFlowError(error === "access_denied" ? "access_denied" : "server_error", `Google returned ${error}`);
  const state = params.get("state");
  const code = params.get("code");
  if (!flow || !state || !sameToken(state, flow.state)) throw new AuthFlowError("state_mismatch");
  if (!code) throw new AuthFlowError("exchange_failed", "No authorization code");
  return code;
}

// ── Code exchange ────────────────────────────────────────────────

/**
 * Exchanges the code (with the PKCE verifier) for tokens and reads the
 * identity from the ID token. The token arrives straight from Google over
 * TLS, so per OIDC Core §3.1.3.7 its claims are checked rather than its
 * signature: issuer, audience, expiry and a verified email.
 */
export async function exchangeCode(
  config: GoogleConfig,
  origin: string,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
  now = Math.floor(Date.now() / 1000),
): Promise<SessionInput> {
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri(origin),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AuthFlowError("exchange_failed", "Token endpoint unreachable");
  }
  if (!res.ok) throw new AuthFlowError("exchange_failed", `Token endpoint answered ${res.status}`);
  const body = (await res.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!body || typeof body.id_token !== "string") throw new AuthFlowError("exchange_failed", "No ID token");

  let claims: Record<string, unknown>;
  try {
    claims = decodeJwt(body.id_token);
  } catch {
    throw new AuthFlowError("exchange_failed", "Malformed ID token");
  }
  const aud = claims.aud;
  const audOk = aud === config.clientId || (Array.isArray(aud) && aud.includes(config.clientId));
  if (!GOOGLE_ISSUERS.includes(String(claims.iss)) || !audOk) throw new AuthFlowError("exchange_failed", "ID token not for this app");
  if (typeof claims.exp !== "number" || claims.exp < now - 60) throw new AuthFlowError("exchange_failed", "ID token expired");
  if (typeof claims.sub !== "string" || !claims.sub) throw new AuthFlowError("exchange_failed", "ID token has no subject");
  const email = typeof claims.email === "string" ? claims.email : null;
  if (email && claims.email_verified !== true) throw new AuthFlowError("unverified_email");

  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : (email?.split("@")[0] ?? "Researcher");
  return { id: `google:${claims.sub}`, name: name.slice(0, 120), email, provider: "google" };
}
