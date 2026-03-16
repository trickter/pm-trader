type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, payload?: unknown) {
  const prefix = `[pm-trader][${level}]`;
  if (payload === undefined) {
    console[level](prefix, message);
    return;
  }

  console[level](prefix, message, payload);
}

export const logger = {
  info: (message: string, payload?: unknown) => log("info", message, payload),
  warn: (message: string, payload?: unknown) => log("warn", message, payload),
  error: (message: string, payload?: unknown) => log("error", message, payload),
};
