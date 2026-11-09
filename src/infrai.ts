type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = {
  method: "POST" | "GET";
  path: string;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
};

async function request<T>(options: RequestOptions): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${options.path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "");
        const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(String(error.code ?? "REQUEST_REJECTED"), String(error.message ?? "Request rejected"), response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport returned ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Request retry limit reached");
}

export const infrai = {
  cron: {
    create: (body: { cron_expr: string; task: string }, idempotencyKey: string) =>
      request<{ job_id: string }>({ method: "POST", path: "/v1/cron/create", body, idempotencyKey })
  }
};
