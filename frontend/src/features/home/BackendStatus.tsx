import { getBackendHealth } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

/** Server component — fetches the real backend health endpoint, no mocked status. */
export async function BackendStatus() {
  const health = await getBackendHealth();
  const isOnline = health.status === "ok";

  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-text-primary">Backend API</p>
        <p className="text-sm text-text-muted">
          {isOnline
            ? `Connected to ${health.service}`
            : "Not reachable — start the FastAPI dev server"}
        </p>
      </div>
      <Badge tone={isOnline ? "success" : "error"}>
        {isOnline ? "Online" : "Offline"}
      </Badge>
    </Card>
  );
}
