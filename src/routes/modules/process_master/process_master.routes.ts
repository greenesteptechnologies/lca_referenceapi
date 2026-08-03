import { Router } from "express";
import {
	getProcessCategoryMasterList,
	getProcessMasterList,
	saveProcess,
	saveProcessCategory,
} from "../../../controllers/modules/process_master/process_master.controller";

const router = Router();

router.get("/Process-category", getProcessCategoryMasterList);
router.post("/Process-category/save", saveProcessCategory);


router.get("/Process", getProcessMasterList);
router.post("/Process/save", saveProcess);


export default router;
