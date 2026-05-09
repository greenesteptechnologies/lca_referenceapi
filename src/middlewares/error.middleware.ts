import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    correlationId: req.correlationId,
  });
};