import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Badge";
import "./classroom.css";

export function ClassroomHeader({
  teacher = false,
  student = false,
}: {
  teacher?: boolean;
  student?: boolean;
}) {
  return (
    <header className="classroom-header">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/" aria-label="StackSpeak home">
          <Logo />
        </Link>
        <span className="hidden h-5 border-l border-border-subtle sm:block" />
        <Link
          href={student ? "#main-content" : "/classroom"}
          className="text-sm font-medium text-text-muted"
        >
          Classroom
        </Link>
        <Badge tone={student ? "info" : "accent"}>
          {student ? "Student exercise" : "Teacher workspace"}
        </Badge>
      </div>
      {teacher && (
        <form action="/classroom/logout" method="post">
          <button className="classroom-text-button" type="submit">
            Sign out
          </button>
        </form>
      )}
    </header>
  );
}
