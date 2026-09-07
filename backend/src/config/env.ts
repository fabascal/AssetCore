import dotenv from "dotenv";

dotenv.config();

const DEV_JWT_SECRET = "assetcore_dev_secret_change_me";
const DEV_REFRESH_SECRET = "assetcore_refresh_secret_change_me";

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const nodeEnv = (process.env.NODE_ENV ?? "development").trim();
const isProduction = nodeEnv === "production";

const jwtSecret = requireEnv("JWT_SECRET", DEV_JWT_SECRET);
const refreshTokenSecret = requireEnv("REFRESH_TOKEN_SECRET", DEV_REFRESH_SECRET);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const corsOrigins = corsOrigin.split(",").map((o) => o.trim()).filter(Boolean);
const cookieSecure = (process.env.COOKIE_SECURE ?? "false") === "true";
const webhookSecret = process.env.WEBHOOK_SECRET ?? "";
const allowLocalhostCors = (process.env.ALLOW_LOCALHOST_CORS ?? "false") === "true";
const allCorsHttp = corsOrigins.length > 0 && corsOrigins.every((o) => o.startsWith("http://"));

if (isProduction) {
  const failures: string[] = [];

  if (jwtSecret === DEV_JWT_SECRET || jwtSecret.length < 32) {
    failures.push("JWT_SECRET must be set to a strong random value (min 32 chars)");
  }
  if (refreshTokenSecret === DEV_REFRESH_SECRET || refreshTokenSecret.length < 32) {
    failures.push("REFRESH_TOKEN_SECRET must be set to a strong random value (min 32 chars)");
  }
  if (!cookieSecure && !allCorsHttp) {
    failures.push("COOKIE_SECURE must be true when CORS uses HTTPS origins");
  }
  if (corsOrigins.some((o) => o.includes("localhost")) && !allowLocalhostCors) {
    failures.push(
      "CORS_ORIGIN must not include localhost in production (set ALLOW_LOCALHOST_CORS=true only for staging)",
    );
  }
  if (corsOrigins.length === 0) {
    failures.push("CORS_ORIGIN must list at least one allowed frontend origin");
  }
  if (!webhookSecret || webhookSecret.length < 16) {
    failures.push("WEBHOOK_SECRET must be set (min 16 chars) in production");
  }
  if (!process.env.DATABASE_URL) {
    failures.push("DATABASE_URL is required");
  }

  if (failures.length > 0) {
    throw new Error(`Production environment validation failed:\n- ${failures.join("\n- ")}`);
  }

  if (!cookieSecure && allCorsHttp) {
    console.warn(
      "[assetcore-backend] COOKIE_SECURE=false with HTTP CORS — enable HTTPS and COOKIE_SECURE=true before go-live.",
    );
  }
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  refreshTokenSecret,
  accessTokenExpiresInSec: Number(process.env.ACCESS_TOKEN_EXPIRES_IN_SEC ?? 900),
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 7),
  cookieSecure,
  cookieDomain: process.env.COOKIE_DOMAIN ?? "",
  corsOrigin,
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
  webhookSecret,
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  providerNotifyWebhookUrl: process.env.PROVIDER_NOTIFY_WEBHOOK_URL ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
  providerWhatsAppTo: process.env.PROVIDER_WHATSAPP_TO ?? "",
};
