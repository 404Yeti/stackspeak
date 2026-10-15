import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Progress — StackSpeak" };

export default function ProgressPage() {
  return (
    <ComingSoon
      title="Progress"
      description="Technical and spoken-English progress tracking, scored separately, is planned for a future sprint once challenge attempts exist."
    />
  );
}
