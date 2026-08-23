import { describe, it, expect } from "vitest";
import { graphQuerySchema } from "./graph.validators.js";

describe("graphQuerySchema", () => {
  it("defaults scope to 'file' when omitted", () => {
    const result = graphQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scope).toBe("file");
  });

  it("accepts scope=file without root", () => {
    const result = graphQuerySchema.safeParse({ scope: "file" });
    expect(result.success).toBe(true);
  });

  it("rejects scope=symbol without root", () => {
    const result = graphQuerySchema.safeParse({ scope: "symbol" });
    expect(result.success).toBe(false);
  });

  it("accepts scope=symbol with a valid root uuid", () => {
    const result = graphQuerySchema.safeParse({ scope: "symbol", root: "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid scope value", () => {
    const result = graphQuerySchema.safeParse({ scope: "repo" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid root", () => {
    const result = graphQuerySchema.safeParse({ scope: "symbol", root: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
