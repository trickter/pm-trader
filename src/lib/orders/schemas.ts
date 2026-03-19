import { z } from "zod";

export const manualOrderSchema = z.object({
  marketId: z.string().min(1),
  tokenId: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  size: z.number().positive(),
  price: z.number().positive(),
});
