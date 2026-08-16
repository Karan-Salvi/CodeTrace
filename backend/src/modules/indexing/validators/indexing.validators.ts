import { z } from "zod";

export const triggerIndexParamsSchema = z.object({
  id: z.string().uuid(),
});
