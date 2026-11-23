import { Request, Response } from "express";
import { successResponse } from "../utils/response";
import { ENV } from "../config/env";

export const runTest = (_req: Request, res: Response) => {
  res.json(
    successResponse(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: ENV.NODE_ENV || "development",
      },
      "Reference API is alive"
    )
  );
};
