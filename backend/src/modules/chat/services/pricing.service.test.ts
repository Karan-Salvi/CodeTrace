import { describe, it, expect, vi, afterEach } from "vitest";
import { computeCostUsd } from "./pricing.service.js";

describe("computeCostUsd", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("computes cost from input and output tokens separately for a known model", () => {
    const cost = computeCostUsd("gemini-2.5-flash", { promptTokens: 1000, candidatesTokens: 1000 });
    // 1000/1000 * 0.000075 + 1000/1000 * 0.0003 = 0.000375
    expect(cost).toBeCloseTo(0.000375, 6);
  });

  it("returns 0 for 0 tokens", () => {
    expect(computeCostUsd("gemini-2.5-flash", { promptTokens: 0, candidatesTokens: 0 })).toBe(0);
  });

  it("falls back to the default rate and warns for an unrecognized model", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cost = computeCostUsd("some-future-model", { promptTokens: 1000, candidatesTokens: 1000 });
    expect(cost).toBeCloseTo(0.009375, 6);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("does not warn for a recognized model", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    computeCostUsd("gemini-2.5-flash", { promptTokens: 100, candidatesTokens: 100 });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
