import { Request, Response } from "express";
import sql, { getPool } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
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


// export const getCompanyProfile = asyncHandler(async (req: Request, res: Response) => {
  
//   const pool = await getPool();
//   const request = pool.request();

//   const companyId = req.query.companyId;
//   if (companyId !== undefined) {
//     const parsedCompanyId = Number(companyId);
//     if (Number.isNaN(parsedCompanyId)) {
//       const err: any = new Error("companyId must be a number");
//       err.status = 400;
//       throw err;
//     }
//     request.input("CompanyId", sql.Int, parsedCompanyId);
//   }

//   const result = await request.execute("lca_master.gs_GetCompanyProfile");
//   res.json(successResponse(result.recordset, "Company profile fetched"));
// });

export const getCountries = asyncHandler(async (_req: Request, res: Response) => {
  const pool = await getPool();
  const request = pool.request();

  // Hardcode Queries
  // const result = await request.query(
  //   "SELECT * FROM lca_common.gs_CountryMaster"
  // );
  // const result = await request.query(GET_COUNTRIES);

  // Stored Procedure
  const result = await request.execute("lca_common.gs_GetCountry");
  // console.log("Countries fetched:", result);

  res.json(successResponse(result.recordset, "List of Countries fetched"));
});
