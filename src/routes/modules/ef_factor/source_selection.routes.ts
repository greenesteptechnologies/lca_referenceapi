import { Router } from "express";
import { verifyJWT } from "../../../middlewares/jwt.middleware";
import {
  getActivityEFSourceCandidates,
  saveCompanyActivityEFSourceSelection,
} from "../../../controllers/modules/ef_factor/source_selection.controller";

const router = Router();

router.use(verifyJWT);

router.get("/emission-factors/source-candidates", getActivityEFSourceCandidates);

router.post(
  "/emission-factors/source-selection",
  saveCompanyActivityEFSourceSelection,
);

export default router;
