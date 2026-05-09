import { Router } from "express";
import { deleteEmissionFactor, getEmissionFactorDashbaord, getEmissionFactorList, getEmissionFactorReferenceData, getEmissionFactorSetup, saveEmissionFactor } from "../../../controllers/modules/ef_factor/ef_factor.controller";

const router = Router();

router.get("/reference", getEmissionFactorReferenceData);

router.get("/dashboard", getEmissionFactorDashbaord);

router.get("/list", getEmissionFactorList);

router.get("/setup", getEmissionFactorSetup);

router.post("/save", saveEmissionFactor);

router.delete("/delete/:id", deleteEmissionFactor);

export default router;
