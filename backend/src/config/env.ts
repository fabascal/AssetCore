import dotenv from "dotenv";

dotenv.config();

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: requireEnv("JWT_SECRET", "assetcore_dev_secret_change_me"),
  refreshTokenSecret: requireEnv("REFRESH_TOKEN_SECRET", "assetcore_refresh_secret_change_me"),
  accessTokenExpiresInSec: Number(process.env.ACCESS_TOKEN_EXPIRES_IN_SEC ?? 900), // 15 minutes
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 7),
  cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",
  cookieDomain: process.env.COOKIE_DOMAIN ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl: requireEnv("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  providerNotifyWebhookUrl: process.env.PROVIDER_NOTIFY_WEBHOOK_URL ?? "",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
  providerWhatsAppTo: process.env.PROVIDER_WHATSAPP_TO ?? "",
};
