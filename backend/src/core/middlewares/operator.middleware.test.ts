import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireOperator } from "./operator.middleware.js";
import { env } from "../../config/env.js";

describe("requireOperator", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = { user: { id: "user-123" } };
    res = {};
    next = vi.fn();
    env.OPERATOR_USER_ID = "operator-456";
  });

  it("calls next() with no error if user ID matches operator ID", () => {
    env.OPERATOR_USER_ID = "user-123";
    requireOperator(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() with a forbidden AppError if user ID does not match operator ID", () => {
    requireOperator(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  it("calls next() with a forbidden AppError if env.OPERATOR_USER_ID is unset", () => {
    env.OPERATOR_USER_ID = undefined;
    requireOperator(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });
});
