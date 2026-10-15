export type HealthStatus = {
  status: "ok" | "unreachable";
  service?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Calls the backend health endpoint. Never throws — a down backend renders as "unreachable". */
export async function getBackendHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return { status: "unreachable" };
    }

    const data = (await response.json()) as { status: string; service: string };
    return { status: "ok", service: data.service };
  } catch {
    return { status: "unreachable" };
  }
}
