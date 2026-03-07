const warned = new Set<string>();

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getEnv(name: string, fallback?: string) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  return fallback;
}

export function requireEnv(name: string, options?: { allowInDev?: boolean; devFallback?: string }) {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;

  const isProd = process.env.NODE_ENV === "production" || process.env.RENDER || process.env.REPLIT_ENVIRONMENT === "production" || !!process.env.REPL_ID;
  
  // Replit-provided secrets or Render environment variables
  const requiredVars = ["DATABASE_URL", "SOLANA_RPC_URL", "AUTH_SECRET", "ENCRYPTION_KEY"];
  if (requiredVars.includes(name)) {
    const val = process.env[name];
    if (val && val.trim().length > 0) return val;
    
    // In Replit/Render/Prod, we don't allow fallbacks for these critical vars
    if (isProd) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
  }

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
