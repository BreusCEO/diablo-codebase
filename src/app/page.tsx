import type { Metadata } from "next";
import { SignIn } from "@/components/brand/SignIn";
import { isGoogleConfigured } from "@/lib/auth/env";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: { absolute: `Sign in · ${BRAND.name}` } };

/**
 * Sign-in. Static: signed-in visitors never see it (the proxy sends them to
 * the workspace), and whether Google is offered is fixed per deployment.
 */
export default function Page() {
  return <SignIn googleEnabled={isGoogleConfigured()} />;
}
