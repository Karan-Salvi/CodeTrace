import { z } from "zod";

export const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(32),
});
