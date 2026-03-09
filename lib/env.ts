const warned =
  typeof globalThis !== "undefined"
    ? ((globalThis as any)._envWarned as Set<string>) || (((globalThis as any)._envWarned = new Set<string>()) as Set<string>)
    : new Set<string>();

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function getEnv(name: string, fallback?: string) {
  const value = process.env[name];
  if (value && value.trim().length > 0 && !value.startsWith("YOUR_") && value !== "placeholder") {
    return value;
  }
  return fallback;
}

export function requireEnv(name: string, options?: { allowInDev?: boolean; devFallback?: string }) {
  const value = getEnv(name);
  if (value) return value;

  const isProd = process.env.NODE_ENV === "production";
  const allowFallback = options?.allowInDev && (!isProd || isBuildPhase());

  if (allowFallback) {
    if (!warned.has(name)) {
      console.warn(`[env] Missing ${name}. Using fallback for non-production runtime.`);
      warned.add(name);
    }
    return options?.devFallback ?? "";
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

export function getMissingRequiredEnv(requiredNames: readonly string[]) {
  return requiredNames.filter((name) => !getEnv(name));
}
