import { z } from "zod";

export const graphQuerySchema = z
  .object({
    scope: z.enum(["file", "symbol"]).default("file"),
    root: z.string().uuid().optional(),
  })
  .refine((data) => data.scope !== "symbol" || !!data.root, {
    message: "root is required when scope is 'symbol'",
    path: ["root"],
  });
