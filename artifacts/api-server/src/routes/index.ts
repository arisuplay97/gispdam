import { Router, type IRouter } from "express";
import healthRouter from "./health";
import valvesRouter from "./valves";
import pipesRouter from "./pipes";
import pipelinesRouter from "./pipelines";
import sourcesRouter from "./sources";
import importExportRouter from "./import-export";
import telemetryRouter from "./telemetry";
import dashboardRouter from "./dashboard";
import monitoringRouter from "./monitoring";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(valvesRouter);
router.use(pipesRouter);
router.use(pipelinesRouter);
router.use(sourcesRouter);
router.use(importExportRouter);
router.use(telemetryRouter);
router.use(dashboardRouter);
router.use(monitoringRouter);
router.use(aiRouter);

export default router;
