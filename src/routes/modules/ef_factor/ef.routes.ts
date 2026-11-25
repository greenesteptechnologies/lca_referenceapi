import { Router } from "express";
import { deleteEmissionFactor, getEmissionFactorDashbaord, getEmissionFactorList, getEmissionFactorReferenceData, getEmissionFactorSetup, saveEmissionFactor } from "../../../controllers/modules/ef_factor/ef_factor.controller";
import { verifyJWT } from "../../../middlewares/jwt.middleware";
// import {
//   requireEfMasterSave,
//   requireEfMasterWrite,
//   requireEfMasterView,
// } from "../../../middlewares/ef-master-permissions.middleware";

const router = Router();

// router.use(verifyJWT);

router.get("/reference", getEmissionFactorReferenceData);

router.get("/dashboard", getEmissionFactorDashbaord);

router.get("/list", getEmissionFactorList);

router.get("/setup", /*requireEfMasterView,*/ getEmissionFactorSetup);

router.post("/save", /*requireEfMasterSave,*/ saveEmissionFactor);

router.delete("/delete/:id", /*requireEfMasterWrite,*/ deleteEmissionFactor);

export default router;
