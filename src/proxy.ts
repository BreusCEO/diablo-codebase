import { NextResponse, type NextRequest } from "next/server";
import { SEED_IDS } from "@/lib/data/seeds";
import { CREATED_ID } from "@/lib/slug";

/**
 * Real 404s for investigation URLs that cannot exist. The page itself streams
 * (its content lives in the browser), and once streaming starts the status is
 * already 200, so the check has to happen here, before rendering.
 *
 * Seeded ids and ids with the shape the app creates pass; anything else is
 * rewritten to a path no route matches, which renders the branded not-found
 * page with status 404.
 */
export function proxy(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/");
  let id = parts[2] ?? "";
  try {
    id = decodeURIComponent(id);
  } catch {
    id = "";
  }
  const ok = parts.length === 3 && ((SEED_IDS as readonly string[]).includes(id) || CREATED_ID.test(id));
  if (ok) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
}

export const config = {
  matcher: ["/investigations/:path+"],
};
