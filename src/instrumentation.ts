import { startStrategyLoop } from "@/lib/strategy/engine";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startStrategyLoop();
  }
}
