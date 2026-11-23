import { Request, Response } from "express";
import sql, { getPool } from "../../../config/db";
import { asyncHandler } from "../../../utils/asyncHandler";
import { errorResponse } from "../../../utils/response";

const sourceSelectionErrors = {
    INVALID_EF_TYPE: { status: 400, message: "Invalid EF type." },
    COMPANY_NOT_FOUND: { status: 404, message: "Company was not found." },
    ACTIVITY_TYPE_NOT_FOUND: {
        status: 404,
        message: "Activity type was not found.",
    },
    FACTOR_KEY_DOES_NOT_MATCH_ACTIVITY_PATH: {
        status: 400,
        message: "Factor key does not match the activity path.",
    },
    SELECTED_EF_NOT_APPLICABLE_OR_NOT_EFFECTIVE: {
        status: 409,
        message: "The selected emission factor is no longer applicable.",
    },
    MANUAL_OVERRIDE_REQUIRED: {
        status: 409,
        message: "Manual override is required for this selection.",
    },
    MANUAL_OVERRIDE_REASON_REQUIRED: {
        status: 400,
        message: "A manual override reason is required.",
    },
    INVALID_USER_FOR_COMPANY: {
        status: 403,
        message: "Authenticated user does not belong to this company.",
    },
} as const;

type SourceSelectionErrorCode = keyof typeof sourceSelectionErrors;

const sourceSelectionSqlErrorCodes: Record<number, SourceSelectionErrorCode> = {
    51160: "INVALID_EF_TYPE",
    51170: "INVALID_EF_TYPE",
    51161: "COMPANY_NOT_FOUND",
    51171: "COMPANY_NOT_FOUND",
    51162: "ACTIVITY_TYPE_NOT_FOUND",
    51172: "ACTIVITY_TYPE_NOT_FOUND",
    51163: "FACTOR_KEY_DOES_NOT_MATCH_ACTIVITY_PATH",
    51173: "FACTOR_KEY_DOES_NOT_MATCH_ACTIVITY_PATH",
    51174: "SELECTED_EF_NOT_APPLICABLE_OR_NOT_EFFECTIVE",
    51175: "MANUAL_OVERRIDE_REQUIRED",
    51176: "MANUAL_OVERRIDE_REASON_REQUIRED",
    51177: "INVALID_USER_FOR_COMPANY",
};

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPositiveSqlInt(value: unknown): value is number {
    return isPositiveInteger(value) && value <= 2_147_483_647;
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= maxLength
    );
}

function isEfType(value: unknown): value is "ACTIVITY" | "SPEND" {
    return value === "ACTIVITY" || value === "SPEND";
}

function toCamelCase(value: string): string {
    return value
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .split(/[_\s]+/)
        .map((part, index) =>
            index === 0
                ? part.toLowerCase()
                : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
        )
        .join("");
}

function throwSourceSelectionSqlError(error: unknown): never {
    if (typeof error !== "object" || error === null) {
        throw error;
    }

    type SqlError = { number?: number; message?: string };
    const requestError = error as SqlError & {
        originalError?: { info?: SqlError };
        precedingErrors?: SqlError[];
    };
    const errors = [
        requestError,
        requestError.originalError?.info,
        ...(requestError.precedingErrors ?? []),
    ];

    for (const sqlError of errors) {
        if (!sqlError) {
            continue;
        }

        const message = sqlError.message?.toUpperCase();
        const code =
            (sqlError.number && sourceSelectionSqlErrorCodes[sqlError.number]) ??
            (message &&
                (Object.keys(sourceSelectionErrors) as SourceSelectionErrorCode[]).find(
                    (errorCode) => message.includes(errorCode),
                ));

        if (code) {
            const { status, message } = sourceSelectionErrors[code];
            throw Object.assign(new Error(message), { status, code });
        }
    }

    throw error;
}

export const getActivityEFSourceCandidates = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Number(req.user?.CompanyId);
        const activityTypeId = Number(req.query.activityTypeId);
        const { factorKey, efType, fiscalYearCode } = req.query;

        if (!isPositiveSqlInt(companyId)) {
            return res.status(401).json(errorResponse("Invalid user context."));
        }

        if (
            !isPositiveSqlInt(activityTypeId) ||
            !isNonEmptyString(factorKey, 300) ||
            !isEfType(efType) ||
            !isNonEmptyString(fiscalYearCode, 20)
        ) {
            return res.status(400).json(
                errorResponse(
                    "activityTypeId, factorKey, efType, and fiscalYearCode are required and must be valid.",
                ),
            );
        }

        const pool = await getPool();
        const result = await pool
            .request()
            .input("CompanyID", sql.Int, companyId)
            .input("ActivityTypeID", sql.Int, activityTypeId)
            .input("FactorKey", sql.VarChar(300), factorKey.trim())
            .input("EF_Type", sql.VarChar(20), efType)
            .input("FiscalYearCode", sql.NVarChar(20), fiscalYearCode.trim())
            .execute("lca_master.gs_GetActivityEFSourceCandidates")
            .catch(throwSourceSelectionSqlError);

        const candidates = (result.recordset ?? []).map((row) =>
            Object.fromEntries(
                Object.entries(row).map(([key, value]) => [toCamelCase(key), value]),
            ),
        );

        return res.json(candidates);
    },
);

export const saveCompanyActivityEFSourceSelection = asyncHandler(
    async (req: Request, res: Response) => {
        const companyId = Number(req.user?.CompanyId);
        const userId = Number(req.user?.UserId);
        const {
            fiscalYearCode,
            activityTypeId,
            factorKey,
            efType,
            selectedFactorId,
            isManualOverride,
            overrideReason,
        } = req.body ?? {};

        if (!isPositiveSqlInt(companyId) || !isPositiveInteger(userId)) {
            return res.status(401).json(errorResponse("Invalid user context."));
        }

        const validFactorId =
            selectedFactorId === null || isPositiveInteger(selectedFactorId);
        if (
            !isNonEmptyString(fiscalYearCode, 20) ||
            !isPositiveSqlInt(activityTypeId) ||
            !isNonEmptyString(factorKey, 300) ||
            !isEfType(efType) ||
            !validFactorId ||
            typeof isManualOverride !== "boolean"
        ) {
            return res.status(400).json(errorResponse("Invalid source selection."));
        }

        if (selectedFactorId === null && isManualOverride) {
            return res
                .status(400)
                .json(errorResponse("A cleared selection cannot be a manual override."));
        }

        if (isManualOverride && !isNonEmptyString(overrideReason, 500)) {
            return res
                .status(400)
                .json(errorResponse("A valid overrideReason is required."));
        }

        const pool = await getPool();
        const result = await pool
            .request()
            .input("CompanyID", sql.Int, companyId)
            .input("FiscalYearCode", sql.NVarChar(20), fiscalYearCode.trim())
            .input("ActivityTypeID", sql.Int, activityTypeId)
            .input("FactorKey", sql.VarChar(300), factorKey.trim())
            .input("EF_Type", sql.VarChar(20), efType)
            .input("SelectedFactorID", sql.BigInt, selectedFactorId)
            .input("IsManualOverride", sql.Bit, isManualOverride)
            .input(
                "OverrideReason",
                sql.NVarChar(500),
                isManualOverride ? overrideReason.trim() : null,
            )
            .input("SelectedBy", sql.BigInt, userId)
            .execute("lca_master.gs_SaveCompanyActivityEFSourceSelection")
            .catch(throwSourceSelectionSqlError);

        if (selectedFactorId === null) {
            return res.json({ selectionCleared: true });
        }

        const savedSelection = result.recordset?.[0];
        if (!savedSelection) {
            return res
                .status(500)
                .json(errorResponse("Source selection was not returned."));
        }

        return res.json({
            selectionSaved: Boolean(savedSelection.SelectionSaved),
            selectedFactorId: savedSelection.SelectedFactorID,
            isManualOverride: Boolean(savedSelection.IsManualOverride),
            requiresManualOverride: Boolean(savedSelection.RequiresManualOverride),
        });
    },
);