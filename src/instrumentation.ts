import { startStrategyLoop } from "@/lib/strategy/engine";
import { startPolymarketStreams } from "@/lib/polymarket/ws";

let registered = false;

export async function register() {
  // Guard against multiple invocations of register() in the same process
  // (e.g. Next.js hot-reload or multiple workers sharing a module cache).
  if (registered) {
    return;
  }
  registered = true;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    startPolymarketStreams();
    startStrategyLoop();
  }
}
