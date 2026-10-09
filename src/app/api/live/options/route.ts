import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { isTeamMember } from "@/lib/live/team";

/** GET /api/live/options: what this signed-in user may choose. Never returns a key. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      claude: !!process.env.ANTHROPIC_API_KEY?.trim(),
      canUseGemini: isTeamMember(session.user.email) && !!process.env.GEMINI_API_KEY?.trim(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
