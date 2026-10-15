import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Interview Practice — StackSpeak" };

export default function InterviewPracticePage() {
  return (
    <ComingSoon
      title="Interview Practice"
      description="Simulated technical interviews — explaining trade-offs and defending decisions out loud to an AI interviewer — are planned for a future sprint."
    />
  );
}
