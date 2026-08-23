import { z } from "zod";

export const usageSummaryQuerySchema = z.object({
  days: z.coerce.number().int().refine((n) => n === 7 || n === 30 || n === 90, {
    message: "days must be 7, 30, or 90",
  }).default(30),
});
