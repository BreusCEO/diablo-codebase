import type { Metadata } from "next";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Faq } from "@/components/pricing/Faq";
import { Plans } from "@/components/pricing/Plans";
import { SectionHead } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Diablo is free during early access. Here is what it will cost after.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Pricing" title="Free during early access.">
        Here is what Diablo will cost afterwards. Experiments call your own AI system, so your provider bills the model
        usage, and Diablo shows the estimate before anything runs.
      </PageHero>

      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Plans />
        </div>
      </section>

      <section id="faq" className="scroll-mt-16 border-t">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead eyebrow="Questions" title="What people ask." />
          <Faq />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
