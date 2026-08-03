import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { successResponse } from "../../../utils/response";
import { getPool } from "../../../config/db";

const getSqlErrorMessage = (error: any) => {
  return (
    error?.originalError?.info?.message ||
    error?.message ||
    "Request failed"
  );
};

const isValidAction = (action: string) => {
  return ["INSERT", "UPDATE", "DELETE"].includes(action);
};

const getActionSuccessMessage = (
  action: string,
  entity: "Process category" | "Process",
) => {
  if (action === "INSERT") {
    return `${entity} created successfully`;
  }

  if (action === "UPDATE") {
    return `${entity} updated successfully`;
  }

  if (action === "DELETE") {
    return `${entity} deleted successfully`;
  }

  return `${entity} saved successfully`;
};

export const getProcessCategoryMasterList = asyncHandler(
  async (req: Request, res: Response) => {
    const industryId = req.query.industryId
      ? Number(req.query.industryId)
      : null;

    const processCategoryId = req.query.processCategoryId
      ? Number(req.query.processCategoryId)
      : null;

    const searchText = req.query.searchText
      ? String(req.query.searchText)
      : null;

    if (
      req.query.processCategoryId !== undefined &&
      Number.isNaN(processCategoryId as number)
    ) {
      return res.status(400).json({
        success: false,
        message: "processCategoryId must be a valid number",
      });
    }

    const pool = await getPool();

    const result = await pool
      .request()
      .input("IndustryID", industryId)
      .input("SearchText", searchText)
      .execute("lca_common.gs_GetProcessCategoryList");

    const rows = result.recordset ?? [];

    const filteredRows = processCategoryId
      ? rows.filter(
          (row: any) =>
            Number(
              row.ProcessCategoryID ??
                row.ProcessCategoryId ??
                row.processCategoryId,
            ) === processCategoryId,
        )
      : rows;

    res.json(
      successResponse(
        filteredRows,
        "Process category master fetched successfully",
      ),
    );
  },
);

export const getProcessMasterList = asyncHandler(
  async (req: Request, res: Response) => {
    const industryId = req.query.industryId
      ? Number(req.query.industryId)
      : null;

    const processCategoryId = req.query.processCategoryId
      ? Number(req.query.processCategoryId)
      : null;

    const processId = req.query.processId
      ? Number(req.query.processId)
      : null;

    const searchText = req.query.searchText
      ? String(req.query.searchText)
      : null;

    if (req.query.processId !== undefined && Number.isNaN(processId as number)) {
      return res.status(400).json({
        success: false,
        message: "processId must be a valid number",
      });
    }

    const pool = await getPool();

    const result = await pool
      .request()
      .input("IndustryID", industryId)
      .input("ProcessCategoryID", processCategoryId)
      .input("SearchText", searchText)
      .execute("lca_common.gs_GetProcessList");

    const rows = result.recordset ?? [];

    const filteredRows = processId
      ? rows.filter(
          (row: any) =>
            Number(row.ProcessID ?? row.ProcessId ?? row.processId) === processId,
        )
      : rows;

    res.json(
      successResponse(
        filteredRows,
        "Process master fetched successfully",
      ),
    );
  },
);

export const saveProcessCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const action = String(req.body?.action || "").toUpperCase();
    const processCategoryId = req.body?.processCategoryId
      ? Number(req.body.processCategoryId)
      : null;

    if (!isValidAction(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be INSERT, UPDATE or DELETE",
      });
    }

    if (action === "DELETE" && !processCategoryId) {
      return res.status(400).json({
        success: false,
        message: "processCategoryId is required for DELETE",
      });
    }

    if (action !== "DELETE") {
      if (!req.body?.industryId || !req.body?.categoryName) {
        return res.status(400).json({
          success: false,
          message: "industryId and categoryName are required",
        });
      }

      if (action === "UPDATE" && !processCategoryId) {
        return res.status(400).json({
          success: false,
          message: "processCategoryId is required for UPDATE",
        });
      }
    }

    const pool = await getPool();

    try {
      const result = await pool
        .request()
        .input("Action", action)
        .input("ProcessCategoryID", processCategoryId)
        .input("IndustryID", req.body?.industryId ? Number(req.body.industryId) : null)
        .input("CategoryName", req.body?.categoryName || null)
        .input("Description", req.body?.description || null)
        .input(
          "ParentCategoryID",
          req.body?.parentCategoryId ? Number(req.body.parentCategoryId) : null,
        )
        .input(
          "IsActive",
          req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
        )
        .input(
          "IsProductionProcess",
          req.body?.isProductionProcess === undefined
            ? false
            : Boolean(req.body.isProductionProcess),
        )
        .execute("lca_common.gs_SaveProcessCategory");

      return res.json(
        successResponse(
          result.recordset?.[0] ?? null,
          getActionSuccessMessage(action, "Process category"),
        ),
      );
    } catch (error: any) {
      error.status = 400;
      error.message = getSqlErrorMessage(error);
      throw error;
    }
  },
);

export const saveProcess = asyncHandler(async (req: Request, res: Response) => {
  const action = String(req.body?.action || "").toUpperCase();
  const processId = req.body?.processId ? Number(req.body.processId) : null;

  if (!isValidAction(action)) {
    return res.status(400).json({
      success: false,
      message: "action must be INSERT, UPDATE or DELETE",
    });
  }

  if (action === "DELETE" && !processId) {
    return res.status(400).json({
      success: false,
      message: "processId is required for DELETE",
    });
  }

  if (action !== "DELETE") {
    if (!req.body?.industryId || !req.body?.processCategoryId || !req.body?.processName) {
      return res.status(400).json({
        success: false,
        message: "industryId, processCategoryId and processName are required",
      });
    }

    if (action === "UPDATE" && !processId) {
      return res.status(400).json({
        success: false,
        message: "processId is required for UPDATE",
      });
    }
  }

  const pool = await getPool();

  try {
    const result = await pool
      .request()
      .input("Action", action)
      .input("ProcessID", processId)
      .input("IndustryID", req.body?.industryId ? Number(req.body.industryId) : null)
      .input(
        "ProcessCategoryID",
        req.body?.processCategoryId ? Number(req.body.processCategoryId) : null,
      )
      .input("ProcessName", req.body?.processName || null)
      .input("Description", req.body?.description || null)
      .input(
        "IsMandatoryDefault",
        req.body?.isMandatoryDefault === undefined
          ? false
          : Boolean(req.body.isMandatoryDefault),
      )
      .input(
        "IsActive",
        req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
      )
      .execute("lca_common.gs_SaveProcess");

    return res.json(
      successResponse(
        result.recordset?.[0] ?? null,
        getActionSuccessMessage(action, "Process"),
      ),
    );
  } catch (error: any) {
    error.status = 400;
    error.message = getSqlErrorMessage(error);
    throw error;
  }
});
