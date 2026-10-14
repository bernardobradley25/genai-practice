import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reflowRouter from "./reflow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reflowRouter);

export default router;
