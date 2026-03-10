import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = (() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Ensure connectionString is a valid string
    if (typeof connectionString !== 'string') {
      throw new Error(`DATABASE_URL must be a string, got ${typeof connectionString}`);
    }

    // Strip whitespace and validate
    const cleanConnectionString = connectionString.trim();
    if (!cleanConnectionString) {
      throw new Error("DATABASE_URL is empty after trimming");
    }

    // Validate URL format for Render/external databases
    if (!cleanConnectionString.startsWith('postgres://') && !cleanConnectionString.startsWith('postgresql://')) {
      throw new Error("Invalid DATABASE_URL format - must start with postgres:// or postgresql://");
    }

    // Create pool with explicit string configuration to avoid type issues
    const poolConfig: pg.PoolConfig = {
      connectionString: String(cleanConnectionString),
      // Set reasonable defaults for external databases
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000
    };

    const pool = new pg.Pool(poolConfig);

    // Handle pool errors gracefully without crashing
    pool.on('error', (err: Error) => {
      console.error('[Prisma Pool Error]', err.message);
    });

    pool.on('connect', () => {
      console.log('[Prisma] Successfully connected to external database');
    });

    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ 
      adapter,
      errorFormat: 'minimal'
    });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }

    return client;
  } catch (error) {
    console.error("Failed to initialize Prisma client:", error instanceof Error ? error.message : error);
    throw error;
  }
})();
