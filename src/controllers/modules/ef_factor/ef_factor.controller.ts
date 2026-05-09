import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { successResponse } from "../../../utils/response";
import sql, { getPool } from "../../../config/db";

export const getEmissionFactorReferenceData = asyncHandler(
  async (_req: Request, res: Response) => {
    const pool = await getPool();
    const result = await pool
      .request()
      .execute("lca_common.gs_GetEmissionFactorReferenceData");

    const recordsets = Array.isArray(result.recordsets)
      ? result.recordsets
      : [];

    // console.log("Recordsets:", recordsets);

    const categoryTypes = recordsets[0] ?? [];
    const categories = recordsets[1] ?? [];
    const sources = recordsets[2] ?? [];
    const scopeLevels = recordsets[3] ?? [];
    const mixComponents = recordsets[4] ?? [];

    res.json(
      successResponse(
        {
          categoryTypes,
          categories,
          sources,
          scopeLevels,
          mixComponents,
          // recordsets,
        },
        "Emission factor reference data fetched",
      ),
    );
  },
);

export const getEmissionFactorDashbaord = asyncHandler(
  async (_req: Request, res: Response) => {
    const pool = await getPool();

    const result = await pool
      .request()
      .execute("lca_common.gs_GetEmissionFactorDashboard");

    const recordsets = Array.isArray(result.recordsets)
      ? result.recordsets
      : [];

    const [
      summaryCards = [],
      scopeDistribution = [],
      typeDistribution = [],
      topSources = [],
      recentlyModified = [],
    ] = recordsets;

    // console.log("Recordsets:", recordsets);

    res.json(
      successResponse(
        {
          summary: summaryCards[0] ?? {},
          scopeDistribution,
          typeDistribution,
          topSources,
          recentlyModified,
        },
        "Emission factor dashboard data fetched",
      ),
    );
  },
);

export const getEmissionFactorList = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      searchText = null,
      efType = null,
      scopeLevel = null,
      isActive = null,
      sourceId = null,
      pageNo = 1,
      pageSize = 20,
    } = req.query;

    const pool = await getPool();

    const result = await pool
      .request()
      .input("SearchText", searchText)
      .input("EFType", efType)
      .input("ScopeLevel", scopeLevel)
      .input(
        "IsActive",
        isActive !== null && isActive !== undefined
          ? Number(isActive)
          : null
      )
      .input(
        "SourceID",
        sourceId ? Number(sourceId) : null
      )
      .input("PageNo", Number(pageNo))
      .input("PageSize", Number(pageSize))
      .execute("lca_common.gs_GetEmissionFactorList");

    const rows = result.recordset ?? [];

    const totalRecords =
      rows.length > 0
        ? rows[0].TotalRecords
        : 0;

    res.json(
      successResponse(
        {
          items: rows,
          pagination: {
            pageNo: Number(pageNo),
            pageSize: Number(pageSize),
            totalRecords,
            totalPages: Math.ceil(
              totalRecords / Number(pageSize)
            ),
          },
        },
        "Emission factor list fetched"
      )
    );
  }
);

export const getEmissionFactorSetup = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      mode,
      id,
    } = req.query;

    const pool = await getPool();

    const result = await pool
      .request()
      .input("Mode", mode)
      .input(
        "FactorID",
        id ? Number(id) : null
      )
      .execute("lca_common.gs_GetEmissionFactorSetup");

    const recordsets = Array.isArray(result.recordsets)
      ? result.recordsets
      : [];

    const [
      factorDetails = [],
      mixDetails = [],
      uiMeta = [],
    ] = recordsets;

    res.json(
      successResponse(
        {
          factor:
            factorDetails[0] ?? null,

          mixDetails,

          uiMeta:
            uiMeta[0] ?? {},
        },
        "Emission factor setup fetched"
      )
    );
  }
);

export const saveEmissionFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const pool = await getPool();

    const {
      mix = [],
      ...payload
    } = req.body;

    // --------------------------------------------------
    // TVP
    // --------------------------------------------------

    const tvp = new sql.Table(
      "lca_common.tt_EmissionFactorMix"
    );

    tvp.columns.add(
      "ComponentName",
      sql.NVarChar(150)
    );

    tvp.columns.add(
      "Percentage",
      sql.Decimal(9, 4)
    );

    tvp.columns.add(
      "SortOrder",
      sql.Int
    );

    if (Array.isArray(mix)) {
      mix.forEach((item: any) => {
        tvp.rows.add(
          item.componentName ?? null,
          item.percentage ?? 0,
          item.sortOrder ?? 0
        );
      });
    }

    // --------------------------------------------------
    // REQUEST
    // --------------------------------------------------

    const request = pool.request();

    const inputMap: Record<string, any> = {
      FactorID: payload.factorID ?? null,

      CategoryID: payload.categoryID,
      FactorName: payload.factorName,

      EF_Type: payload.efType,

      EF_CO2: payload.efCO2 ?? 0,
      EF_CH4: payload.efCH4 ?? 0,
      EF_N2O: payload.efN2O ?? 0,
      EF_CO2e: payload.efCO2e,

      EF_UnitID: payload.efUnitID ?? null,
      CurrencyCode: payload.currencyCode ?? null,

      ScopeLevel: payload.scopeLevel,

      RegionID: payload.regionID ?? null,
      CountryID: payload.countryID ?? null,
      StateID: payload.stateID ?? null,
      CityID: payload.cityID ?? null,
      TenantID: payload.tenantID ?? null,

      SourceID: payload.sourceID ?? null,
      ProcessID: payload.processID ?? null,
      IndustryID: payload.industryID ?? null,
      ProductID: payload.productID ?? null,

      IsCompositeFactor:
        payload.isCompositeFactor ?? false,

      Note: payload.note ?? null,

      EffectiveFrom: payload.effectiveFrom,
      EffectiveTo: payload.effectiveTo ?? null,

      IsActive: payload.isActive ?? true,
    };

    Object.entries(inputMap).forEach(
      ([key, value]) => {
        request.input(key, value);
      }
    );

    request.input("Mix", tvp);

    // --------------------------------------------------
    // EXECUTE
    // --------------------------------------------------

    const result = await request.execute(
      "lca_common.gs_UpsertEmissionFactor"
    );

    const recordsets = Array.isArray(
      result.recordsets
    )
      ? result.recordsets
      : [];

    const [
      saveResult = [],
      auditLogs = [],
    ] = recordsets;

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    res.json(
      successResponse(
        {
          result: saveResult[0] ?? {},
          auditLogs,
        },
        "Emission factor saved successfully"
      )
    );
  }
);

export const deleteEmissionFactor = asyncHandler(
  async (req: Request, res: Response) => {
    const factorID = Number(req.params.id);

    if (!factorID) {
      throw new Error("FactorID is required");
    }

    const pool = await getPool();

    const result = await pool
      .request()
      .input("FactorID", factorID)
      .execute(
        "lca_common.gs_DeleteEmissionFactor"
      );

    const recordsets = Array.isArray(result.recordsets)
      ? result.recordsets
      : [];

    const deleteResult = recordsets[0] ?? [];
    const auditLogs = recordsets[1] ?? [];

    res.json(
      successResponse(
        {
          result: deleteResult[0] ?? {},
          auditLogs,
        },
        "Emission factor deleted successfully"
      )
    );
  }
);