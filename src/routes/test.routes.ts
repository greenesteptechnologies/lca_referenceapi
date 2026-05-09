import { Router } from "express";
import { 
    // getCompanyProfile, 
    getCountries, runTest, 
} from "../controllers/test.controller";

const router = Router();

router.get("/", runTest);
router.get("/test", runTest);
// router.get("/company-profile", getCompanyProfile);
// router.get("/countries", getCountries);


export default router;
