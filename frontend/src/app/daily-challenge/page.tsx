import type { Metadata } from "next";
import { ChallengeWorkspace } from "@/features/challenge/ChallengeWorkspace";

export const metadata: Metadata = {
  title: "Daily Challenge — StackSpeak",
};

export default function DailyChallengePage() {
  return <ChallengeWorkspace />;
}
