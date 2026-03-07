const warned = new Set<string>();

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getEnv(name: string, fallback?: string) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return fallback;
}

// This will run during server startup in Next.js
if (typeof window === "undefined") {
  const required = ["DATABASE_URL", "SOLANA_RPC_URL", "AUTH_SECRET", "ENCRYPTION_KEY", "TELEGRAM_BOT_TOKEN", "INTERNAL_API_KEY"];
  for (const name of required) {
    const val = process.env[name];
    if (!val || val.trim().length === 0 || val.startsWith("YOUR_") || val === "placeholder") {
      const errorMsg = `\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\nCRITICAL ERROR: Missing required environment variable: ${name}\n\nThe application CANNOT start without this secret.\nPlease go to the "Secrets" tab (lock icon) and add "${name}".\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n`;
      console.error(errorMsg);
      // We exit to prevent the server from actually being "ready" in a broken state
      if (typeof process !== "undefined" && typeof process.exit === "function") {
        process.exit(1);
      }
      throw new Error(`Missing Secret: ${name}`);
    }
  }
}

export function requireEnv(name: string, options?: { allowInDev?: boolean; devFallback?: string }) {
  const value = process.env[name];
  // Check if it's a placeholder or empty
  if (value && value.trim().length > 0 && !value.startsWith("YOUR_") && value !== "placeholder") return value;

  const requiredVars = ["DATABASE_URL", "SOLANA_RPC_URL", "AUTH_SECRET", "ENCRYPTION_KEY", "TELEGRAM_BOT_TOKEN", "INTERNAL_API_KEY"];
  if (requiredVars.includes(name)) {
    const errorMsg = `\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\nCRITICAL ERROR: Missing required environment variable: ${name}\n\nThe application CANNOT start without this secret.\nPlease go to the "Secrets" tab (lock icon) and add "${name}".\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n`;
    console.error(errorMsg);
    // In Next.js dev mode, this will show a big error overlay
    if (typeof window === "undefined" && typeof process !== "undefined" && typeof process.exit === "function") {
      process.exit(1);
    }
    throw new Error(`Missing Secret: ${name}`);
  }

  const isProd = process.env.NODE_ENV === "production" || process.env.RENDER || process.env.REPLIT_ENVIRONMENT === "production" || (typeof process.env.REPL_ID === 'string' && process.env.REPL_ID.length > 0);
  const allowFallback = (!isProd && options?.allowInDev) || isBuildPhase();

  if (allowFallback) {
    if (!warned.has(name)) {
      console.warn(`[env] Missing ${name}. Using fallback for local/build phase.`);
      warned.add(name);
    }
    return options?.devFallback ?? "";
  }

  throw new Error(`Missing required environment variable: ${name}`);
}
