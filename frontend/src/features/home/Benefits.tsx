import { Card } from "@/components/ui/Card";

const columns = [
  {
    title: "For students",
    items: [
      "Practice explaining code before the interview, not during it",
      "Feedback on technical understanding and English, kept separate",
      "Build the habit with a 10–15 minute daily challenge",
    ],
  },
  {
    title: "For working developers",
    items: [
      "Sharpen code-reading and debugging speed",
      "Learn to review and verify AI-generated code",
      "Communicate decisions clearly in reviews and meetings",
    ],
  },
];

export function Benefits() {
  return (
    <section className="flex flex-col gap-8 px-6 py-16 lg:px-[120px] lg:py-20">
      <h2 className="text-3xl font-bold tracking-tight text-text-primary">
        Built for people who write code and have to talk about it
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        {columns.map((column) => (
          <Card key={column.title} className="flex flex-col gap-3">
            <h3 className="text-2xl font-semibold tracking-tight text-text-primary">{column.title}</h3>
            <ul className="flex flex-col gap-2">
              {column.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-sm font-medium text-success">
                    ✓
                  </span>
                  <span className="text-base leading-[26px] text-text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
