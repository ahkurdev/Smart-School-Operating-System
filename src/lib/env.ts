import { z } from "zod";

/**
 * Validated server environment. Importing this module validates the environment
 * once and exposes a typed object. Server-only: never import from client code.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ROOT_DOMAIN: z.string().default("localhost:3000"),

  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),
  ATTENDANCE_SIGNING_KEY: z
    .string()
    .min(16, "ATTENDANCE_SIGNING_KEY must be at least 16 chars"),
  ENCRYPTION_KEY: z.string().min(16, "ENCRYPTION_KEY must be at least 16 chars"),

  ATTENDANCE_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  ATTENDANCE_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).default(5),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.storage"),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().optional().default(""),
  S3_BUCKET: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  AI_PROVIDER: z.string().default("openai-compatible"),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_MAX_TOOL_CALLS: z.coerce.number().int().positive().default(6),

  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASSWORD: z.string().optional().default(""),
  SMTP_FROM: z.string().default("no-reply@example.edu"),

  JOB_QUEUE_DRIVER: z.enum(["inline"]).default("inline"),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Parse and cache the server environment. Throws a readable error listing every
 * missing/invalid variable rather than crashing on the first one.
 */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
