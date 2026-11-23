import { NextFunction, Request, Response } from "express";
import { getPool } from "../config/db";
import { logger } from "../config/logger";
import { persistApiAuditLog } from "../services/auditLog.service";

const actionByMethod: Record<string, string> = {
  GET: "FETCH",
  POST: "INSERT",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

const actionByMethodAndRoute: Record<string, string> = {
  "POST /ef/save": "UPSERT",
  "POST /temp/scenario-process": "UPSERT",
  "POST /temp/scenario-process/bulk": "UPSERT",
  "POST /temp/scenario/:scenarioId/:tenantId/:userId/ai-insights/generate":
    "GENERATE",
};

const sensitiveFieldPattern =
  /password|passwd|pwd|secret|token|credential|authorization|api.?key|client.?key|private.?key|salt/i;

function sanitizeAuditData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditData);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, nestedValue]) =>
        sensitiveFieldPattern.test(key)
          ? []
          : [[key, sanitizeAuditData(nestedValue)]],
      ),
    );
  }

  return value;
}

function getEndpoint(req: Request): string {
  if (typeof req.route?.path === "string") {
    const apiPrefix = req.originalUrl.match(/^\/api\/v\d+\/[^/?]+/i)?.[0];
    if (apiPrefix) {
      return `${apiPrefix}${req.route.path}`.replace(/\/+/g, "/");
    }
  }

  let endpoint = req.originalUrl.split("?")[0];

  for (const [name, rawValue] of Object.entries(req.params)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value) {
        endpoint = endpoint.replace(encodeURIComponent(value), `:${name}`);
      }
    }
  }

  return endpoint.replace(/\/+/g, "/");
}

function pascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function getEntityName(endpoint: string): string {
  const segments = endpoint
    .replace(/^\/api\/v\d+\/?/i, "")
    .split("/")
    .filter(Boolean);
  const root = (segments[0] || "ApiRequest").toLowerCase();
  const child = (segments[1] || "").toLowerCase();

  if (root === "test" && child === "test") return "TestRequest";

  if (root === "ef") {
    if (child === "reference") return "EmissionFactorReferenceData";
    if (child === "dashboard") return "EmissionFactorDashboard";
    if (child === "setup") return "EmissionFactorSetup";
    return "EmissionFactor";
  }

  if (root === "process-master") {
    if (child === "process-category") return "ProcessCategory";
    if (child === "process") return "Process";
  }

  if (root === "temp") {
    if (child === "processmaster") return "ProcessCategory";
    if (child === "myprocess") return "MyProcess";
    if (child === "scenario-process") return "ScenarioProcess";
    if (child === "scenario") {
      if (segments.includes("ai-insights")) return "ScenarioAIInsight";
      if (segments.includes("workspace")) return "ScenarioAIWorkspace";
      return "Scenario";
    }
  }

  const ignoredSegments = new Set([
    "api", "v1", "test", "ef", "process-master", "temp", "save", "delete",
    "list", "reference", "dashboard", "setup", "bulk", "details",
  ]);
  const resourceSegment = segments.find(
    (segment) =>
      !ignoredSegments.has(segment.toLowerCase()) && !segment.startsWith(":"),
  );

  return resourceSegment
    ? pascalCase(resourceSegment.replace(/s$/, ""))
    : `${pascalCase(root)}Request`;
}

function findEntityKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const key = findEntityKey(item);
      if (key) return key;
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const entries = Object.entries(value);
  const match = entries.find(
    ([name, item]) =>
      /(?:^id$|id$|guid$|uuid$)/i.test(name) &&
      !/^(company|tenant|user|correlation|request)id$/i.test(name) &&
      !sensitiveFieldPattern.test(name) &&
      (typeof item === "string" || typeof item === "number") &&
      String(item).trim().length > 0,
  );

  if (match) {
    return String(match[1]);
  }

  for (const [, nestedValue] of entries) {
    const key = findEntityKey(nestedValue);
    if (key) {
      return key;
    }
  }

  return null;
}

function getEntityKey(req: Request, responsePayload: unknown): string | null {
  return (
    findEntityKey(responsePayload) ??
    findEntityKey(req.params) ??
    findEntityKey(req.body) ??
    findEntityKey(req.query)
  );
}

export const auditLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const action = actionByMethod[req.method];
  if (!req.path.startsWith("/api/") || !action) {
    return next();
  }

  let responsePayload: unknown;
  const originalJson = res.json;
  res.json = function (
    this: Response,
    body?: Parameters<Response["json"]>[0],
  ) {
    responsePayload = body;
    return originalJson.call(this, body);
  };

  res.once("finish", () => {
    const companyId = Number(req.user?.CompanyId);
    const userId = Number(req.user?.UserId);
    const correlationId = req.correlationId ?? "";

    if (
      !Number.isInteger(companyId) ||
      companyId <= 0 ||
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !correlationId
    ) {
      logger.warn({
        message:
          "Skipping API audit log because authenticated identity is unavailable",
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        correlationId,
      });
      return;
    }

    const endpoint = getEndpoint(req);
    const serializedResponse = responsePayload === undefined
      ? "null"
      : JSON.stringify(responsePayload);
    const responseData = serializedResponse === undefined
      ? "null"
      : JSON.stringify(
        sanitizeAuditData(JSON.parse(serializedResponse)),
      );
    const details = JSON.stringify({
      Old: null,
      New: responseData,
    });

    const normalizedEndpoint = endpoint
      .toLowerCase()
      .replace(/^\/api\/v\d+/i, "") || "/";
    const actionName =
      actionByMethodAndRoute[`${req.method} ${normalizedEndpoint}`] ?? action;

    void getPool()
      .then((pool) =>
        persistApiAuditLog(pool, {
          companyId,
          userId,
          serviceName: "LCA.Reference.Api",
          action: actionName,
          actionStatus: res.statusCode < 400 ? "SUCCESS" : "FAILED",
          entityName: getEntityName(endpoint),
          entityKey: getEntityKey(req, responsePayload) ?? correlationId,
          details,
          correlationId,
        }),
      )
      .catch((error) => {
        logger.error({
          message: "Failed to persist API audit log",
          error: error instanceof Error ? error.message : String(error),
          method: req.method,
          endpoint,
          statusCode: res.statusCode,
          correlationId,
        });
      });
  });

  next();
};
