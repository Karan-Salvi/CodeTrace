import { z } from "zod";

export const installationCallbackQuerySchema = z.object({
  installation_id: z.coerce.number().int().positive(),
  state: z.string().min(1),
  setup_action: z.enum(["install", "update", "request"]).default("install"),
});
