import { getAccessToken } from "@/lib/storage";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function safeParseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  const authEnabled = options.auth !== false;
  if (authEnabled) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  // Default JSON content-type when sending a stringified body.
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await safeParseJson(res);
    const message =
      isRecord(data) && "error" in data
        ? String(data.error)
        : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return (await res.json()) as T;
}
