import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const courses = [
  {
    badge: "Flagship",
    tone: "accent" as const,
    highlighted: true,
    title: "Reading AI-Generated Code",
    description:
      "Understand, verify, and defend code written by AI tools instead of accepting it blindly.",
  },
  {
    badge: "Intermediate",
    tone: "neutral" as const,
    highlighted: false,
    title: "Debugging & Problem Solving",
    description: "Find bugs, explain your reasoning, fix them, and prove it with tests.",
  },
  {
    badge: "All levels",
    tone: "neutral" as const,
    highlighted: false,
    title: "Technical Interview English",
    description: "Answer technical questions clearly, concisely, and with confidence.",
  },
];

export function CoursePreviews() {
  return (
    <section className="flex flex-col gap-8 px-6 py-16 lg:px-[120px] lg:py-20">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs font-medium text-accent-soft">COURSES</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-primary">
          Learn the way engineers actually work
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Card key={course.title} highlighted={course.highlighted} className="flex flex-col gap-3">
            <Badge tone={course.tone}>{course.badge}</Badge>
            <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{course.title}</h3>
            <p className="text-sm text-text-muted">{course.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
