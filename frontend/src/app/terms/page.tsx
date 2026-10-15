import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Terms — StackSpeak" };

export default function TermsPage() {
  return (
    <ComingSoon
      title="Terms"
      description="Terms of service will be published here before StackSpeak is available beyond the public preview."
    />
  );
}
