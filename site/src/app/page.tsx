import { CtaBand } from "@/components/CtaBand";
import { Hero } from "@/components/home/Hero";
import { Investigation } from "@/components/home/Investigation";
import { Knowledge } from "@/components/home/Knowledge";
import { Loop } from "@/components/home/Loop";
import { Principle } from "@/components/home/Principle";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Loop />
      <Principle />
      <Investigation />
      <Knowledge />
      <CtaBand />
    </>
  );
}
