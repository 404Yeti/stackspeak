import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Privacy — StackSpeak" };

export default function PrivacyPage() {
  return (
    <ComingSoon
      title="Privacy"
      description="A privacy policy will be published here before StackSpeak collects any personal data beyond what's needed to run the public preview."
    />
  );
}
