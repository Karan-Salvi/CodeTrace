import { describe, it, expect, afterAll } from "vitest";
import { redis } from "./redis.js";

describe("redis client", () => {
  afterAll(() => {
    redis.disconnect();
  });

  it("connects and can set/get a key", async () => {
    await redis.set("test:key", "value");
    const value = await redis.get("test:key");
    expect(value).toBe("value");
    await redis.del("test:key");
  });
});
