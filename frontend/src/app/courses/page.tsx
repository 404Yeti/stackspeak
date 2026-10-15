import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Courses — StackSpeak" };

export default function CoursesPage() {
  return (
    <ComingSoon
      title="Courses"
      description="Structured programming courses with lessons and challenges are planned for a future sprint. Nothing is enrolled or tracked here yet."
    />
  );
}
