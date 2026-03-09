/**
 * Environment validation - ensures required secrets are present before app runs
 */

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "SOLANA_RPC_URL",
  "TELEGRAM_BOT_TOKEN",
  "ENCRYPTION_KEY",
  "INTERNAL_API_KEY",
  "NEXT_PUBLIC_APP_URL",
  "ALERTLY_API_BASE_URL",
] as const;

export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET || process.env.JWT_SECRET);

  if (!hasAuthSecret) {
    missing.push("AUTH_SECRET_OR_JWT_SECRET");
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function throwIfMissingEnv(): void {
  const { valid, missing } = validateEnvironment();

  if (!valid) {
    const error = `CRITICAL: Missing required environment variables: ${missing.join(", ")}. Add these secrets in the deployment secrets before running the app.`;
    console.error(error);
    throw new Error(error);
  }
}

export function logEnvStatus(): void {
  const { valid, missing } = validateEnvironment();
  if (valid) {
    console.log("✅ All required environment variables are configured");
  } else {
    console.warn("⚠️  Missing environment variables:", missing);
  }
}
