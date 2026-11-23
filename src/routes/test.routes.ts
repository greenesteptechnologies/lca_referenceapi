import { Router } from "express";
import { 
    runTest, 
} from "../controllers/test.controller";

const router = Router();

router.get("/test", runTest);


export default router;
