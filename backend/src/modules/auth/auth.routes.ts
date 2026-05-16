import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
  changeMyPasswordHandler,
  getMyProfileHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  updateMyProfileHandler,
} from "./auth.controller";

const authRouter = Router();

authRouter.post("/login", loginHandler);
authRouter.post("/refresh", refreshHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", requireAuth, getMyProfileHandler);
authRouter.put("/me", requireAuth, updateMyProfileHandler);
authRouter.put("/me/password", requireAuth, changeMyPasswordHandler);

export default authRouter;
