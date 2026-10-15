import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Practice Lab — StackSpeak" };

export default function PracticeLabPage() {
  return (
    <ComingSoon
      title="Practice Lab"
      description="Free-form debugging and code review practice is planned for a future sprint, behind a reviewed code-execution sandbox."
    />
  );
}
