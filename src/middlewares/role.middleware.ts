import { Request } from "express";

export const getUserRole = (req: Request): string | null => {
  const role = req.user?.Role;
  if (typeof role !== "string") {
    return null;
  }

  const normalized = role.trim().toUpperCase();
  if (
    normalized === "COMPANY ADMIN" ||
    normalized === "TENANT_ADMIN" ||
    normalized === "TENANT ADMIN"
  ) {
    return "COMPANY_ADMIN";
  }
  if (normalized === "ADMIN") {
    return "COMPANY_ADMIN";
  }
  return normalized;
};


