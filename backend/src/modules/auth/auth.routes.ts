import { Router } from "express";
import { loginRateLimiter, refreshRateLimiter } from "../../middlewares/rate-limit.middleware";
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

authRouter.post("/login", loginRateLimiter, loginHandler);
authRouter.post("/refresh", refreshRateLimiter, refreshHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", requireAuth, getMyProfileHandler);
authRouter.put("/me", requireAuth, updateMyProfileHandler);
authRouter.put("/me/password", requireAuth, changeMyPasswordHandler);

export default authRouter;
