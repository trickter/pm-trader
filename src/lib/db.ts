import { PrismaClient } from "@prisma/client";

declare global {
  var __pmTraderPrisma: PrismaClient | undefined;
}

export const db =
  global.__pmTraderPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__pmTraderPrisma = db;
}
