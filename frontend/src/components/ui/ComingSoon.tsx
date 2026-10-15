import { Card } from "./Card";
import { Badge } from "./Badge";

export type ComingSoonProps = {
  title: string;
  description: string;
};

/** Labeled placeholder for routes with no implemented functionality yet — never a fake working feature. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-6 py-24">
      <Badge tone="accent">Coming soon</Badge>
      <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
      <Card className="w-full">
        <p className="text-text-muted">{description}</p>
      </Card>
    </div>
  );
}
