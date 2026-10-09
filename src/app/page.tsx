import type { Metadata } from "next";
import { SignIn } from "@/components/brand/SignIn";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: { absolute: `Sign in · ${BRAND.name}` } };

export default function Page() {
  return <SignIn />;
}
