import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/pm_trader?schema=public"),
  POLYMARKET_GAMMA_HOST: z.string().url().default("https://gamma-api.polymarket.com"),
  POLYMARKET_DATA_HOST: z.string().url().default("https://data-api.polymarket.com"),
  POLYMARKET_CLOB_HOST: z.string().url().default("https://clob.polymarket.com"),
  POLYMARKET_CHAIN_ID: z.coerce.number().default(137),
  POLYMARKET_PRIVATE_KEY: z.string().optional().default(""),
  POLYMARKET_FUNDER_ADDRESS: z.string().optional().default(""),
  POLYMARKET_TRADER_ADDRESS: z.string().optional().default(""),
  POLYMARKET_SIGNATURE_TYPE: z.coerce.number().default(0),
  ENGINE_POLL_INTERVAL_MS: z.coerce.number().default(15000),
  ENGINE_ENABLE_BACKGROUND_LOOP: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SYSTEM_DEFAULT_DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export const env = serverEnvSchema.parse(process.env);
