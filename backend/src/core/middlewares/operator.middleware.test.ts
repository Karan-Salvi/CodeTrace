import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireOperator } from "./operator.middleware.js";
import { env } from "../../config/env.js";

describe("requireOperator", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { user: { id: "user-123" } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    // Reset env operator ID
    // @ts-expect-error - overriding readonly for testing
    env.OPERATOR_USER_ID = "operator-456";
  });

  it("calls next() if user ID matches operator ID", () => {
    // @ts-expect-error
    env.OPERATOR_USER_ID = "user-123";
    requireOperator(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 if user ID does not match operator ID", () => {
    requireOperator(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden: operator access required" });
  });

  it("returns 403 if env.OPERATOR_USER_ID is unset", () => {
    // @ts-expect-error
    env.OPERATOR_USER_ID = undefined;
    requireOperator(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
