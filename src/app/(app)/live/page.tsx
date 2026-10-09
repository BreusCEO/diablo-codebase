import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { LiveInvestigation } from "@/components/live/LiveInvestigation";
import { Page, PageHeader } from "@/components/pages/Library";
import { publicConfig } from "@/lib/live/env";

export const metadata: Metadata = { title: "Live investigation" };

export default function LivePage() {
  return (
    <Page>
      <PageHeader
        title="Live investigation"
        sub="A real model plans the experiments and explains the result. Code calls the system under test, scores every answer and computes every number."
      />
      <div className="mt-8">
        <Suspense fallback={<LiveSkeleton />}>
          <Configured />
        </Suspense>
      </div>
    </Page>
  );
}

/** The model setup is read per request, so adding a key takes effect without a rebuild. No key ever reaches the page. */
async function Configured() {
  await connection();
  return <LiveInvestigation config={publicConfig()} />;
}

function LiveSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      <div className="h-7 w-2/3 rounded-[6px] bg-sunken" />
      <div className="h-40 rounded-[10px] bg-sunken" />
      <div className="h-24 rounded-[10px] bg-sunken" />
    </div>
  );
}
