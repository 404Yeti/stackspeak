import { Hero } from "@/features/home/Hero";
import { LearningSequence } from "@/features/home/LearningSequence";
import { CoursePreviews } from "@/features/home/CoursePreviews";
import { Benefits } from "@/features/home/Benefits";
import { FinalCta } from "@/features/home/FinalCta";

export default function Home() {
  return (
    <div className="flex flex-col">
      <Hero />

      <section id="how-it-works" className="flex flex-col gap-8 px-6 py-16 lg:px-[120px] lg:py-20">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs font-medium text-accent-soft">HOW IT WORKS</p>
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Four steps. One short conversation with a senior engineer.
          </h2>
        </div>
        <LearningSequence />
      </section>

      <CoursePreviews />
      <Benefits />
      <FinalCta />
    </div>
  );
}
