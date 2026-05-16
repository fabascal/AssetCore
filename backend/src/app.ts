import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";
import { env } from "./config/env";
import apiRouter from "./routes";

const app = express();

app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use("/api/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.use("/api", apiRouter);

export default app;
