import type { Response } from "express";
import type { ApiSuccessResponse, ApiErrorResponse } from "@codetrace/shared-types";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  const body: ApiSuccessResponse<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

export function sendError(res: Response, statusCode: number, code: string, message: string) {
  const body: ApiErrorResponse = { success: false, error: { code, message } };
  return res.status(statusCode).json(body);
}
