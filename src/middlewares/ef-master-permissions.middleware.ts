import { RequestHandler, Response } from "express";
import { errorResponse } from "../utils/response";
import { getUserRole } from "./role.middleware";

const viewAndTenantRoles = [
  "SUPER_ADMIN",
  "COMPANY_ADMIN",
  "EF_IMPLEMENTATION_USER",
];
const tenantEfCreateRoles = ["COMPANY_ADMIN", "EF_IMPLEMENTATION_USER"];

const deny = (res: Response, message: string, field?: string) =>
  res
    .status(403)
    .json(errorResponse(message, null, "EF_MASTER_PERMISSION_DENIED", field));

export const requireEfMasterView: RequestHandler = (req, res, next) => {
  const role = getUserRole(req);
  const isViewMode = String(req.query.mode ?? "").trim().toUpperCase() === "VIEW";
  if (isViewMode && (!role || !viewAndTenantRoles.includes(role))) {
    return deny(res, "Your role is not allowed to view this emission factor");
  }
  return next();
};

export const requireEfMasterSave: RequestHandler = (req, res, next) => {
  const role = getUserRole(req);
  if (!role) {
    return deny(res, "A verified user role is required");
  }
  if (role === "SUPER_ADMIN") {
    return next();
  }
  if (!tenantEfCreateRoles.includes(role)) {
    return deny(res, "Your role is not allowed to create emission factors");
  }

  const body = req.body ?? {};
  if (body.FactorID !== undefined && body.FactorID !== null) {
    return deny(
      res,
      "You may only create new emission factors, not edit existing ones",
      "FactorID",
    );
  }

  const scope = String(body.ScopeLevel ?? "").trim().toUpperCase();
  if (scope !== "TENANT") {
    return deny(
      res,
      "Only tenant-scoped emission factors can be created by your role",
      "ScopeLevel",
    );
  }

  const companyID = Number(req.user?.CompanyId);
  const tenantID = Number(body.TenantID);
  if (
    body.TenantID === undefined ||
    body.TenantID === null ||
    String(body.TenantID).trim() === "" ||
    !Number.isFinite(companyID) ||
    !Number.isFinite(tenantID) ||
    companyID !== tenantID
  ) {
    return deny(
      res,
      "You may only create emission factors for your assigned tenant",
      "TenantID",
    );
  }

  if (body.IsProvisional !== true) {
    return deny(
      res,
      "Tenant users can only create provisional emission factors; only Super Admin users can approve them",
      "IsProvisional",
    );
  }

  return next();
};

export const requireEfMasterWrite: RequestHandler = (req, res, next) => {
  const role = getUserRole(req);
  if (!role) {
    return deny(res, "A verified user role is required");
  }
  if (role !== "SUPER_ADMIN") {
    return deny(
      res,
      "Only Super Admin users can delete emission factors",
    );
  }
  return next();
};
