import { Router } from "express";
import {
	getProcessCategoryMasterList,
	getProcessMasterList,
	saveProcess,
	saveProcessCategory,
} from "../../../controllers/modules/process_master/process_master.controller";
import { verifyJWT } from "../../../middlewares/jwt.middleware";
import { getUserRole } from "../../../middlewares/role.middleware";

const router = Router();

router.use(verifyJWT);
// router.use((req, _res, next) => {
//   getUserRole(req); // logs the verified JWT role
//   next();
// });

router.get("/Process-category", getProcessCategoryMasterList);
router.post("/Process-category/save", saveProcessCategory);


router.get("/Process", getProcessMasterList);
router.post("/Process/save", saveProcess);


export default router;
