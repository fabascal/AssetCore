import { Router } from "express";
import authRouter from "../modules/auth/auth.routes";
import usersRouter from "../modules/users/users.routes";
import assetsRouter from "../modules/assets/assets.routes";
import menusRouter from "../modules/menus/menus.routes";
import ticketsRouter from "../modules/tickets/tickets.routes";
import helpdeskConfigRouter from "../modules/helpdesk-config/helpdesk-config.routes";
import dashboardRouter from "../modules/dashboard/dashboard.routes";
import webhooksRouter from "../modules/webhooks/webhooks.routes";
import aiLogsRouter from "../modules/ai-logs/ai-logs.routes";
import projectsRouter from "../modules/projects/projects.routes";
import itamConfigRouter from "../modules/itam-config/itam-config.routes";
import reportsRouter from "../modules/reports/reports.routes";
import { requireAuth } from "../middlewares/auth.middleware";
import { checkPermission } from "../middlewares/permission.middleware";

const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/webhooks", webhooksRouter);
apiRouter.use(requireAuth);
apiRouter.use("/menus", menusRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/ai-logs", aiLogsRouter);
apiRouter.use("/users", checkPermission("users.read"), usersRouter);
apiRouter.use("/assets", assetsRouter);
apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/helpdesk-config", helpdeskConfigRouter);
apiRouter.use("/itam-config", itamConfigRouter);
apiRouter.use("/reports", reportsRouter);

export default apiRouter;
