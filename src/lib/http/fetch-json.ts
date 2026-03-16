import { logger } from "@/lib/logger";
import { wait } from "@/lib/utils";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const hostTimers = new Map<string, number>();
const execFileAsync = promisify(execFile);

type FetchJsonOptions<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  init?: RequestInit;
  minIntervalMs?: number;
  retries?: number;
};

async function fetchViaCurl(url: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const headers = Object.entries((init?.headers ?? {}) as Record<string, string>).flatMap(([key, value]) => [
    "-H",
    `${key}: ${value}`,
  ]);
  const body = typeof init?.body === "string" ? ["--data", init.body] : [];
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "--fail",
    "--max-time",
    "20",
    "-X",
    method,
    ...headers,
    ...body,
    url,
  ]);

  return JSON.parse(stdout);
}

async function throttleByHost(url: string, minIntervalMs: number) {
  const host = new URL(url).host;
  const now = Date.now();
  const nextAllowedAt = hostTimers.get(host) ?? now;
  const delay = Math.max(0, nextAllowedAt - now);

  if (delay > 0) {
    await wait(delay);
  }

  hostTimers.set(host, Date.now() + minIntervalMs);
}

export async function fetchJson<TSchema extends z.ZodTypeAny>(
  url: string,
  options: FetchJsonOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const retries = options.retries ?? 2;
  const minIntervalMs = options.minIntervalMs ?? 250;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await throttleByHost(url, minIntervalMs);
      const requestInit: RequestInit = {
        ...options.init,
        headers: {
          Accept: "application/json",
          ...(options.init?.headers ?? {}),
        },
        next: { revalidate: 0 },
      };

      let raw: unknown;
      try {
        const response = await fetch(url, requestInit);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        raw = await response.json();
      } catch (fetchError) {
        logger.warn("fetchJson switching to curl fallback", {
          url,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
        raw = await fetchViaCurl(url, requestInit);
      }

      return options.schema.parse(raw);
    } catch (error) {
      const isLastAttempt = attempt === retries;
      logger.warn("fetchJson retry", {
        url,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      if (isLastAttempt) {
        throw error;
      }
      await wait(250 * 2 ** attempt);
    }
  }

  throw new Error(`Unreachable fetchJson state for ${url}`);
}
