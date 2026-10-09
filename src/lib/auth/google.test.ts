import { describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import {
  AuthFlowError,
  authorizationUrl,
  checkCallback,
  exchangeCode,
  GOOGLE_TOKEN_URL,
  openFlow,
  pkceChallenge,
  sameToken,
  sealFlow,
} from "./google";

const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const CONFIG = { clientId: "client-123.apps.googleusercontent.com", clientSecret: "shh" };
const ORIGIN = "https://diablo.example";
const NOW = 1_800_000_000;

/** An unsigned-looking but well-formed ID token; claims are what we check. */
async function idToken(claims: Record<string, unknown>) {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("google-would-sign-this"));
}
const goodClaims = {
  iss: "https://accounts.google.com",
  aud: CONFIG.clientId,
  sub: "1234567890",
  exp: NOW + 3600,
  email: "ada@example.com",
  email_verified: true,
  name: "Ada Lovelace",
};
const tokenResponse = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AuthFlowError ? e.code : "other";
  }
  return null;
};

describe("PKCE", () => {
  it("derives the RFC 7636 S256 challenge", async () => {
    // Appendix B of RFC 7636.
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("builds an authorization URL with state, S256 challenge and the callback", async () => {
    const url = await authorizationUrl(CONFIG, ORIGIN, "st4te", "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    expect(q.get("response_type")).toBe("code");
    expect(q.get("client_id")).toBe(CONFIG.clientId);
    expect(q.get("redirect_uri")).toBe("https://diablo.example/api/auth/google/callback");
    expect(q.get("state")).toBe("st4te");
    expect(q.get("code_challenge")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("scope")).toBe("openid email profile");
    expect(q.has("client_secret")).toBe(false);
  });
});

describe("flow cookie and state", () => {
  it("seals and opens the flow; rejects another secret and garbage", async () => {
    const flow = { state: "abc", verifier: "v".repeat(64), next: "/settings" };
    const sealed = await sealFlow(flow, SECRET);
    expect(await openFlow(sealed, SECRET)).toEqual(flow);
    expect(await openFlow(sealed, "another-secret-0123456789-abcdefghijklmn")).toBeNull();
    expect(await openFlow("garbage", SECRET)).toBeNull();
    expect(await openFlow(undefined, SECRET)).toBeNull();
  });

  it("compares state tokens exactly", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("abc", "abcd")).toBe(false);
    expect(sameToken("", "")).toBe(false);
  });

  it("accepts a callback whose state matches the cookie", () => {
    const flow = { state: "s1", verifier: "v", next: "/home" };
    expect(checkCallback(new URLSearchParams({ code: "c0de", state: "s1" }), flow)).toBe("c0de");
  });

  it("rejects a missing cookie, a missing or different state, and a missing code", () => {
    const flow = { state: "s1", verifier: "v", next: "/home" };
    expect(code(() => checkCallback(new URLSearchParams({ code: "c", state: "s1" }), null))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ code: "c" }), flow))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ code: "c", state: "s2" }), flow))).toBe("state_mismatch");
    expect(code(() => checkCallback(new URLSearchParams({ state: "s1" }), flow))).toBe("exchange_failed");
  });

  it("maps Google's ?error= before anything else", () => {
    expect(code(() => checkCallback(new URLSearchParams({ error: "access_denied", state: "s1" }), null))).toBe("access_denied");
    expect(code(() => checkCallback(new URLSearchParams({ error: "server_error" }), null))).toBe("server_error");
  });
});

describe("exchangeCode (network mocked)", () => {
  it("posts the code with the PKCE verifier and returns the identity", async () => {
    const fetchMock = tokenResponse({ id_token: await idToken(goodClaims), access_token: "x" });
    const who = await exchangeCode(CONFIG, ORIGIN, "c0de", "verifier-xyz", fetchMock, NOW);
    expect(who).toEqual({ id: "google:1234567890", name: "Ada Lovelace", email: "ada@example.com", provider: "google" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c0de");
    expect(body.get("code_verifier")).toBe("verifier-xyz");
    expect(body.get("redirect_uri")).toBe("https://diablo.example/api/auth/google/callback");
  });

  it("falls back to the email's local part when there is no name", async () => {
    const fetchMock = tokenResponse({ id_token: await idToken({ ...goodClaims, name: undefined }) });
    expect((await exchangeCode(CONFIG, ORIGIN, "c", "v", fetchMock, NOW)).name).toBe("ada");
  });

  const failsWith = async (fetchMock: typeof fetch) => {
    try {
      await exchangeCode(CONFIG, ORIGIN, "c", "v", fetchMock, NOW);
      return null;
    } catch (e) {
      return e instanceof AuthFlowError ? e.code : "other";
    }
  };

  it("rejects token errors, missing ID tokens and network failures", async () => {
    expect(await failsWith(tokenResponse({ error: "invalid_grant" }, 400))).toBe("exchange_failed");
    expect(await failsWith(tokenResponse({ access_token: "x" }))).toBe("exchange_failed");
    expect(await failsWith(tokenResponse({ id_token: "not-a-jwt" }))).toBe("exchange_failed");
    expect(await failsWith(vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("offline"))))).toBe("exchange_failed");
  });

  it("rejects ID tokens for another app, from another issuer, or expired", async () => {
    expect(await failsWith(tokenResponse({ id_token: await idToken({ ...goodClaims, aud: "someone-else" }) }))).toBe("exchange_failed");
    expect(await failsWith(tokenResponse({ id_token: await idToken({ ...goodClaims, iss: "https://evil.example" }) }))).toBe("exchange_failed");
    expect(await failsWith(tokenResponse({ id_token: await idToken({ ...goodClaims, exp: NOW - 3600 }) }))).toBe("exchange_failed");
  });

  it("rejects an unverified email", async () => {
    expect(await failsWith(tokenResponse({ id_token: await idToken({ ...goodClaims, email_verified: false }) }))).toBe("unverified_email");
  });
});
