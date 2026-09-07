import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";
import apiRouter from "./routes";

const app = express();

if (env.isProduction) {
  app.set("trust proxy", 1);
}

const allowedOrigins = env.corsOrigin.split(",").map((o) => o.trim());

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

if (env.isProduction) {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin not allowed: ${origin}`));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/api", apiRouter);
app.use(errorHandler);

export default app;
