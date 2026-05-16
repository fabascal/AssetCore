import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import { listAiLogsHandler } from "../webhooks/webhooks.controller";

const aiLogsRouter = Router();

aiLogsRouter.get("/", checkPermission("ai.logs.read"), listAiLogsHandler);

export default aiLogsRouter;
